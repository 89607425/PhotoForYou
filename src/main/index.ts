import { app, BrowserWindow, ipcMain, dialog, shell, protocol, net } from 'electron';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';
import imghash from 'imghash';
import { initFaceDetection, detectFacesBatch } from './faceDetection';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'PhotoForYou',
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#FFFAF5',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
    },
  });

  if (process.env.ELECTRON_DEV) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }
}

app.whenReady().then(() => {
  protocol.handle('local-file', (request) => {
    const filePath = decodeURIComponent(request.url.replace('local-file://', ''));
    return net.fetch('file://' + filePath);
  });
  initFaceDetection().catch((err) => console.error('Face detection init failed:', err));
  createWindow();
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (!mainWindow) createWindow(); });

const SUPPORTED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.heic', '.heif', '.webp'];

async function scanDirectory(dirPath: string): Promise<{ filePath: string; name: string; size: number }[]> {
  const results: { filePath: string; name: string; size: number }[] = [];

  async function walk(currentPath: string) {
    const entries = await fs.promises.readdir(currentPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        await walk(fullPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (SUPPORTED_EXTENSIONS.includes(ext)) {
          const stat = await fs.promises.stat(fullPath);
          results.push({ filePath: fullPath, name: entry.name, size: stat.size });
        }
      }
    }
  }

  await walk(dirPath);
  return results;
}

ipcMain.handle('dialog:openFolder', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openDirectory'],
    title: '选择照片文件夹',
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

ipcMain.handle('photos:scan', async (_event, folderPath: string) => {
  try {
    const photos = await scanDirectory(folderPath);
    return { success: true, photos, count: photos.length };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('photos:generateThumbnails', async (_event, filePaths: string[], cacheDir: string) => {
  try {
    await fs.promises.mkdir(cacheDir, { recursive: true });
    const thumbnails: { filePath: string; thumbPath: string }[] = [];

    const concurrency = 8;
    for (let i = 0; i < filePaths.length; i += concurrency) {
      const batch = filePaths.slice(i, i + concurrency);
      const results = await Promise.all(
        batch.map(async (filePath) => {
          const thumbName = path.basename(filePath, path.extname(filePath)) + '.webp';
          const thumbPath = path.join(cacheDir, thumbName);
          try {
            await sharp(filePath)
              .resize(400, 400, { fit: 'inside', withoutEnlargement: true })
              .webp({ quality: 80 })
              .toFile(thumbPath);
            return { filePath, thumbPath };
          } catch {
            return null;
          }
        })
      );
      thumbnails.push(...results.filter((r): r is NonNullable<typeof r> => r !== null));
    }

    return { success: true, thumbnails };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('photos:readFull', async (_event, filePath: string) => {
  try {
    const buffer = await fs.promises.readFile(filePath);
    return buffer.buffer;
  } catch {
    return null;
  }
});

ipcMain.handle('photos:readMedium', async (_event, filePath: string) => {
  try {
    const buffer = await sharp(filePath)
      .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();
    return buffer.buffer;
  } catch {
    return null;
  }
});

ipcMain.handle('photos:export', async (_event, photos: { src: string; name: string }[], destFolder: string, mode: 'selected' | 'rejected') => {
  try {
    await fs.promises.mkdir(destFolder, { recursive: true });
    let copied = 0;
    for (let i = 0; i < photos.length; i++) {
      const { src, name } = photos[i];
      const targetName = mode === 'rejected'
        ? `先放一放/${name}`
        : `${String(i + 1).padStart(3, '0')}_${name}`;
      const targetPath = path.join(destFolder, targetName);
      await fs.promises.mkdir(path.dirname(targetPath), { recursive: true });
      await fs.promises.copyFile(src, targetPath);
      copied++;
    }
    return { success: true, copied };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('photos:computeHash', async (_event, filePath: string) => {
  try {
    const hash = await imghash.hash(filePath);
    return { success: true, hash };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('shell:openFolder', async (_event, folderPath: string) => {
  shell.openPath(folderPath);
});

ipcMain.handle('photos:getExifDate', async (_event, filePath: string) => {
  try {
    const meta = await sharp(filePath).metadata();
    return { success: true, date: meta.exif ? null : null };
  } catch {
    return { success: true, date: null };
  }
});

ipcMain.handle('photos:detectFaces', async (_event, filePaths: string[]) => {
  try {
    const results = await detectFacesBatch(filePaths);
    return { success: true, results };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});
