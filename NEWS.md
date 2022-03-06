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
