# Joystik Original Arcade: Android app (WebView)

The Play Store app is a small Android shell that opens https://imissyoujobe-eng.github.io/pocket-arcade/ full screen in a WebView. Game changes still go live with a git push; only the name, icon or Android settings need a new app file.

It replaced the PWABuilder (Trusted Web Activity) build in Nov 2026 because Testers Community won't test TWA apps. Same package as before: `io.github.imissyoujobe.pocketarcade`.

## Build
- Needs JDK 17+ and the Android SDK (platform 36, build-tools 36.0.0). Put `sdk.dir=/path/to/android-sdk` in `local.properties`.
- Raise `versionCode` in `app/build.gradle` for every upload (10 = version 1.1.0, the first WebView build; 11 = 1.1.1, the new icon lettering; 12 = 1.1.2, the phone's side buttons as game buttons).
- `./gradlew bundleRelease` makes the unsigned bundle at `app/build/outputs/bundle/release/app-release.aab`.
- `./gradlew assembleDebug` makes a test copy (`io.github.imissyoujobe.pocketarcade.preview`, "Joystik test") that installs next to the Play version.

## Sign
- James signs with his own upload key (signing.keystore from the October PWABuilder zip). Never commit the key or its passwords.
- Easiest: https://imissyoujobe-eng.github.io/pocket-arcade/sign/ signs the .aab in his browser (nothing is uploaded).
- Or: `jarsigner -keystore signing.keystore -digestalg SHA-256 -sigalg SHA256withRSA app-release.aab my-key-alias`

## What the shell does
- Full screen (bars hidden, swipe to show), follows the phone's rotation, keeps games out from under the camera cutout.
- Back button closes a game or My Scores first, then leaves the app.
- The phone's side (volume) buttons can be game buttons: a game calls `JoystikApp.volumeKeys(true)` while it's being played (lib/kit.js `K.sideKeys`), and the app then sends volume up and down to the page as `AudioVolumeUp` / `AudioVolumeDown` key presses instead of changing the volume. Every new page load hands them back to the volume. Dirt Bowl uses them as GAS and BRAKE (since 1.1.2).
- Links outside /pocket-arcade/ open in the browser. If the first launch has no internet, it shows a "No connection / Try again" screen; after that the site's service worker keeps the games working offline.
- Icon: James's cockpit artwork, new chunky green JOYSTIK lettering since 1.1.1 (Nov 16 2026). Adaptive icon: the picture at 64dp, nudged about 1dp left and down so the whole word sits inside the 66dp safe circle on every launcher shape. Behind it is a copy with the letters painted out, mirrored to the edges and blurred.
