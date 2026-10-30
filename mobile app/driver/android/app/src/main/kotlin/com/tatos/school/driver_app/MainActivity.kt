package com.tatos.school.driver_app

import android.content.pm.ApplicationInfo
import android.view.WindowManager
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {
    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        // Test-only window flag: no persistent device preference is changed.
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "shift_sync/ui_audit")
            .setMethodCallHandler { call, result ->
                if (call.method != "keepScreenOn" ||
                    applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE == 0) {
                    result.notImplemented()
                } else {
                    if (call.arguments == true) {
                        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
                    } else {
                        window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
                    }
                    result.success(null)
                }
            }
    }
}
