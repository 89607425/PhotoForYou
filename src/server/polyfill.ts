import util from 'util';
const u = util as any;
if (typeof u.isNullOrUndefined !== 'function') {
  u.isNullOrUndefined = (val: any) => val === null || val === undefined;
}
if (typeof u.isPrimitive !== 'function') {
  u.isPrimitive = (val: any) => val !== Object(val);
}
