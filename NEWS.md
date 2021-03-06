## 0.0.9    # 2022-05-18 Tim Janik

* Rename dist files to zcam-js.mjs and zcam-js.cjs
* Add math.js functions to exports
* Add srgb_hex() and zcam_hex() methods
* Export zcam_hue_composition() and zcam_hue_angle()
* Add and test maximize_Jz() and minimize_Jz() on Gamut

## 0.0.8    # 2022-05-05 Tim Janik

* Added support to for "Hue Composition" as ZCAM.Hz, range 0…400.
* Export the ZCAM white point as ZCAM_D65.
* Added support to convert ZCAM to/from linear RGB values.
* Adjusted fractional digits of XYZ transformation to better match ZCAM_D65.

## 0.0.7    # 2022-05-02 Tim Janik

* Bundle dist.js as ESM module and provide dist.cjs.
* Added automatic unit testing and moved tests into their units.
* Added linting and cleaned up various parts of the code.
* Fixed some bsearch and spline implementation bugs.
* Added float-array hashtable to cache lengthy calculations.
* Added gamut helper for chroma clamping and calculation caching.
* Added API to explicitely calculate Mz Cz Sz Qz Jz fields.
* BREAKING CHANGE: Colors are in {r, g, b} objects now instead of Arrays.

## 0.0.6    # 2022-03-06 Tim Janik

* Fixed ZCAM tests not catching NaN values
* Fixed the ZCAM transformations lacking the .FL field

## 0.0.5    # 2022-03-06 Tim Janik b20f34e
* Added maxima sources for optimized Jzazbz <-> SRGB transformations
* Added maxima sources for XYZ transformations and D65 white point
  Based on cie.mac from HSLuv by Alexei Boronine
* Added test suite for all ZCAM supplemental paper test values
* Added zcam_hue_find_cusp() to numerically search the (Jz,Cz) cusp
* Added zcam_maximize_Cz() to numerically search for Chroma maximum
* Added optimized sRGB <-> Izazbz, Jzazbz matrixes
* Added ZCAM to & from RGB conversion functions
* Added transforms for chromatic adaptation of the white point
* Added transforms for the Jzazbz and Izazbz color spaces
* Added basic hex RGB, sRGB and linear RGB conversion utilities
* Added math utilities for binary and golden section search
