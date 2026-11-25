package tatos.tech.teacher_app

import android.os.Bundle
import android.view.View
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsAnimationCompat
import androidx.core.view.WindowInsetsCompat
import io.flutter.embedding.android.FlutterActivity

class MainActivity : FlutterActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // Newer Android releases (seen on Android 17) can skip the last inset update after the keyboard hides, so
        // Flutter keeps the keyboard's space as an empty band at the bottom of every page. When the IME animation
        // ends, ask for the current insets again so the Flutter view gets the real (closed-keyboard) values.
        val decor = window.decorView
        ViewCompat.setWindowInsetsAnimationCallback(
            decor,
            object : WindowInsetsAnimationCompat.Callback(DISPATCH_MODE_CONTINUE_ON_SUBTREE) {
                override fun onProgress(
                    insets: WindowInsetsCompat,
                    running: MutableList<WindowInsetsAnimationCompat>,
                ): WindowInsetsCompat = insets

                override fun onEnd(animation: WindowInsetsAnimationCompat) {
                    if (animation.typeMask and WindowInsetsCompat.Type.ime() != 0) refreshInsets(decor)
                }
            },
        )
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) refreshInsets(window.decorView)
    }

    private fun refreshInsets(root: View) {
        root.post {
            ViewCompat.requestApplyInsets(root)
            root.findViewById<View>(FLUTTER_VIEW_ID)?.let { ViewCompat.requestApplyInsets(it) }
        }
    }
}
