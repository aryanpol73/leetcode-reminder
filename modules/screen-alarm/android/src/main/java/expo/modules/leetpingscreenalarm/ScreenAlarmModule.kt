package expo.modules.leetpingscreenalarm

import android.content.Intent
import android.net.Uri
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONObject

class ScreenAlarmModule : Module() {
  private val context get() = requireNotNull(appContext.reactContext)

  override fun definition() = ModuleDefinition {
    Name("LeetPingScreenAlarm")

    Function("permissions") {
      mapOf("fullScreen" to AlarmQueue.canShowFullScreen(context), "overlay" to Settings.canDrawOverlays(context))
    }

    Function("openSettings") { permission: String ->
      val action = if (permission == "overlay") Settings.ACTION_MANAGE_OVERLAY_PERMISSION
        else Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT
      val intent = Intent(action, Uri.parse("package:${context.packageName}")).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      context.startActivity(intent)
    }

    AsyncFunction("setSchedule") { raw: String, enabled: Boolean, overlay: Boolean, exact: Boolean ->
      AlarmQueue.replace(context, raw, enabled, overlay, exact)
    }

    AsyncFunction("addAlarm") { alarm: String ->
      AlarmQueue.add(context, JSONObject(alarm))
    }

    Function("getAlarm") { id: String ->
      AlarmQueue.get(context, id)?.toString()
    }

    AsyncFunction("finish") { id: String, snooze: Boolean ->
      AlarmQueue.finish(context, id, snooze)
    }

    Function("releaseWindow") { id: String ->
      appContext.currentActivity?.let { activity ->
        activity.runOnUiThread { AlarmWindow.release(activity, id) }
      }
    }
  }
}
