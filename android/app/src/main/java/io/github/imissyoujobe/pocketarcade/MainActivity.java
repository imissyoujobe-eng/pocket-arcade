package io.github.imissyoujobe.pocketarcade;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.Insets;
import android.graphics.Typeface;
import android.graphics.drawable.ColorDrawable;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.util.TypedValue;
import android.view.DisplayCutout;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.View;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.window.OnBackInvokedDispatcher;

/**
 * Joystik Original Arcade: the web arcade (imissyoujobe-eng.github.io/pocket-arcade) in a full-screen WebView.
 * Game updates still go live with a git push; the site's service worker keeps the games working offline.
 */
public class MainActivity extends Activity {
    static final String HOME = "https://imissyoujobe-eng.github.io/pocket-arcade/index.html";
    static final String HOST = "imissyoujobe-eng.github.io";
    static final String SCOPE = "/pocket-arcade/";
    static final int BG = 0xFF120D26;
    static final int AMBER = 0xFFFFB02E;

    private WebView web;
    private View offline;
    private boolean clearHistoryOnLoad;
    /** True while a game wants the volume buttons as game buttons (set from the page, cleared on every new page). */
    private volatile boolean volumeKeys;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        Window w = getWindow();
        w.setBackgroundDrawable(new ColorDrawable(BG));
        if (Build.VERSION.SDK_INT >= 30) w.setDecorFitsSystemWindows(false);

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(BG);

        web = new WebView(this);
        web.setBackgroundColor(BG);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);                    // scores and settings (localStorage)
        s.setMediaPlaybackRequiresUserGesture(false);    // game sounds
        s.setUseWideViewPort(true);
        s.setLoadWithOverviewMode(true);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);
        s.setTextZoom(100);                              // big system fonts would break the game layouts
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setUserAgentString(s.getUserAgentString() + " JoystikApp");

        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                Uri u = r.getUrl();
                if (inApp(u)) return false;
                openOutside(u);
                return true;
            }

            @Override
            public void onPageStarted(WebView v, String url, Bitmap icon) {
                volumeKeys = false; // a new page: the volume buttons go back to changing the volume
            }

            @Override
            public void onReceivedError(WebView v, WebResourceRequest r, WebResourceError e) {
                if (r.isForMainFrame()) offline.setVisibility(View.VISIBLE);
            }

            @Override
            public void onPageFinished(WebView v, String url) {
                if (clearHistoryOnLoad && offline.getVisibility() != View.VISIBLE) {
                    clearHistoryOnLoad = false;
                    web.clearHistory();
                }
            }
        });
        web.setWebChromeClient(new WebChromeClient());
        // the page's link to the app: a game calls JoystikApp.volumeKeys(true) while it's being played (lib/kit.js K.sideKeys)
        web.addJavascriptInterface(new Object() {
            @JavascriptInterface
            public void volumeKeys(boolean on) { volumeKeys = on; }
        }, "JoystikApp");
        root.addView(web, new FrameLayout.LayoutParams(-1, -1));

        offline = buildOfflineView();
        offline.setVisibility(View.GONE);
        root.addView(offline, new FrameLayout.LayoutParams(-1, -1));
        setContentView(root);

        // Keep the games out from under the camera cutout (the status and navigation bars are hidden).
        root.setOnApplyWindowInsetsListener((v, insets) -> {
            int l = 0, t = 0, r = 0, b = 0;
            if (Build.VERSION.SDK_INT >= 30) {
                Insets c = insets.getInsets(WindowInsets.Type.displayCutout());
                l = c.left; t = c.top; r = c.right; b = c.bottom;
            } else if (Build.VERSION.SDK_INT >= 28) {
                DisplayCutout c = insets.getDisplayCutout();
                if (c != null) { l = c.getSafeInsetLeft(); t = c.getSafeInsetTop(); r = c.getSafeInsetRight(); b = c.getSafeInsetBottom(); }
            }
            v.setPadding(l, t, r, b);
            return insets;
        });

        if (Build.VERSION.SDK_INT >= 33) {
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(OnBackInvokedDispatcher.PRIORITY_DEFAULT, this::goBack);
        }

        if (state != null) web.restoreState(state);
        if (web.getUrl() == null) web.loadUrl(HOME);
        hideBars();
    }

    static boolean inApp(Uri u) {
        return u != null && "https".equals(u.getScheme()) && HOST.equals(u.getHost())
                && u.getPath() != null && u.getPath().startsWith(SCOPE);
    }

    private void openOutside(Uri u) {
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, u).addCategory(Intent.CATEGORY_BROWSABLE));
        } catch (ActivityNotFoundException ignored) {
        }
    }

    /** Back closes a game or the scores page first (the menu keeps those in its history), then leaves the app. */
    private void goBack() {
        if (offline.getVisibility() != View.VISIBLE && web.canGoBack()) web.goBack();
        else finish();
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() { // Android 12 and older
        goBack();
    }

    /**
     * The phone's side buttons as game buttons: while a game has asked for them, volume up and down go to the page
     * as AudioVolumeUp / AudioVolumeDown key presses (held keys repeat on Android; only the first press and the
     * release are sent) and the volume doesn't change. Any other time they work as usual.
     */
    @Override
    public boolean dispatchKeyEvent(KeyEvent e) {
        int k = e.getKeyCode();
        if (volumeKeys && (k == KeyEvent.KEYCODE_VOLUME_UP || k == KeyEvent.KEYCODE_VOLUME_DOWN)) {
            String key = k == KeyEvent.KEYCODE_VOLUME_UP ? "AudioVolumeUp" : "AudioVolumeDown";
            if (e.getAction() == KeyEvent.ACTION_DOWN && e.getRepeatCount() == 0) sideKey("keydown", key);
            else if (e.getAction() == KeyEvent.ACTION_UP) sideKey("keyup", key);
            return true;
        }
        return super.dispatchKeyEvent(e);
    }

    private void sideKey(String type, String key) {
        web.evaluateJavascript("dispatchEvent(new KeyboardEvent('" + type + "',{key:'" + key + "',code:'" + key + "'}))", null);
    }

    private View buildOfflineView() {
        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setGravity(Gravity.CENTER);
        box.setBackgroundColor(BG);
        int pad = dp(28);
        box.setPadding(pad, pad, pad, pad);
        box.setClickable(true);

        TextView title = new TextView(this);
        title.setText("No connection");
        title.setTextColor(0xFFFFFFFF);
        title.setTypeface(Typeface.DEFAULT_BOLD);
        title.setTextSize(TypedValue.COMPLEX_UNIT_SP, 24);
        title.setGravity(Gravity.CENTER);
        box.addView(title);

        TextView body = new TextView(this);
        body.setText("Joystik needs the internet the first time it opens so it can download the games. After that, they play offline.");
        body.setTextColor(0xFFB4ACD8);
        body.setTextSize(TypedValue.COMPLEX_UNIT_SP, 16);
        body.setGravity(Gravity.CENTER);
        body.setPadding(0, dp(12), 0, dp(24));
        box.addView(body);

        Button retry = new Button(this);
        retry.setText("Try again");
        retry.setAllCaps(false);
        retry.setTextColor(BG);
        retry.setTypeface(Typeface.DEFAULT_BOLD);
        retry.setTextSize(TypedValue.COMPLEX_UNIT_SP, 18);
        GradientDrawable shape = new GradientDrawable();
        shape.setColor(AMBER);
        shape.setCornerRadius(dp(28));
        retry.setBackground(shape);
        retry.setPadding(dp(32), dp(12), dp(32), dp(12));
        retry.setOnClickListener(v -> {
            offline.setVisibility(View.GONE);
            clearHistoryOnLoad = true;
            web.loadUrl(HOME);
        });
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-2, -2);
        lp.gravity = Gravity.CENTER_HORIZONTAL;
        box.addView(retry, lp);
        return box;
    }

    private int dp(int v) {
        return Math.round(v * getResources().getDisplayMetrics().density);
    }

    @SuppressWarnings("deprecation")
    private void hideBars() {
        if (Build.VERSION.SDK_INT >= 30) {
            WindowInsetsController c = getWindow().getInsetsController();
            if (c != null) {
                c.hide(WindowInsets.Type.systemBars());
                c.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            }
        } else {
            getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                    | View.SYSTEM_UI_FLAG_LAYOUT_STABLE | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                    | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                    | View.SYSTEM_UI_FLAG_FULLSCREEN);
        }
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideBars();
    }

    @Override
    protected void onPause() {
        super.onPause();
        web.onPause();
        web.pauseTimers();
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.resumeTimers();
        web.onResume();
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    @Override
    protected void onDestroy() {
        if (web != null) {
            web.stopLoading();
            web.destroy();
        }
        super.onDestroy();
    }
}
