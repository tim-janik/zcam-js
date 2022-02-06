// This Source Code Form is licensed MPL-2.0: http://mozilla.org/MPL/2.0
'use strict';


/// Multiply 3x3 matrix by 3 element vector.
export function matrix33_mul3 (A, V) {
  const [[a,b,c], [d,e,f], [g,h,i]] = A;
  const [x,y,z] = V;
  const u = a*x + b*y + c*z;
  const v = d*x + e*y + f*z;
  const w = g*x + h*y + i*z;
  return [u,v,w];
}
