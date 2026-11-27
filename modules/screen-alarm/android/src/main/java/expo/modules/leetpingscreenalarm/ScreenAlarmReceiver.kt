package expo.modules.leetpingscreenalarm

import android.annotation.SuppressLint
import android.app.Activity
import android.app.ActivityOptions
import android.app.AlarmManager
import android.app.KeyguardManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import android.view.WindowManager
import org.json.JSONArray
import org.json.JSONObject
import java.lang.ref.WeakReference
import java.util.UUID

class ScreenAlarmReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    when (intent.action) {
      AlarmQueue.ACTION_DUE -> AlarmQueue.deliver(context)
      Intent.ACTION_BOOT_COMPLETED, Intent.ACTION_MY_PACKAGE_REPLACED -> AlarmQueue.restore(context)
    }
  }
}

internal object AlarmQueue {
  const val ACTION_DUE = "expo.modules.leetpingscreenalarm.DUE"
  private const val CHANNEL = "leetping-silent-screen"
  private const val NOTIFICATION = 7108
  private const val TIME_TO_LIVE = 30 * 60_000L
  private const val TEN_MINUTES = 10 * 60_000L
  private const val FLAGS = PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT

  private fun preferences(context: Context) = context.getSharedPreferences("leetping-screen-alarms", Context.MODE_PRIVATE)

  private fun read(context: Context, key: String): List<JSONObject> {
    val array = JSONArray(preferences(context).getString(key, "[]") ?: "[]")
    return List(array.length()) { array.getJSONObject(it) }
  }

  private fun write(context: Context, key: String, values: List<JSONObject>) {
    preferences(context).edit().putString(key, JSONArray(values).toString()).apply()
  }

  private fun queue(context: Context) = read(context, "schedule") + read(context, "snoozes")
  private fun JSONObject.time() = getLong("at")

  @Synchronized
  fun replace(context: Context, raw: String, enabled: Boolean, overlay: Boolean, exact: Boolean): Int {
    val update = JSONObject(raw)
    val alarms = update.getJSONArray("alarms")
    val suppliedIds = update.getJSONArray("pendingPlanIds")
    val pendingPlanIds = List(suppliedIds.length()) { suppliedIds.getString(it) }.toSet()
    val solvedUntil = update.getLong("solvedUntil")
    fun shouldKeep(alarm: JSONObject): Boolean {
      if (alarm.getString("id").startsWith("test:")) return true
      val planId = alarm.optString("planId")
      return if (planId.isNotEmpty()) planId in pendingPlanIds else alarm.time() >= solvedUntil
    }
    val now = System.currentTimeMillis()
    val due = read(context, "schedule").filter { it.time() in (now - TIME_TO_LIVE)..now }
    val upcoming = List(alarms.length()) { alarms.getJSONObject(it) }
    val remaining = if (enabled) (due + upcoming).distinctBy { it.getString("id") }.filter(::shouldKeep) else emptyList()
    write(context, "schedule", remaining)
    write(context, "snoozes", if (enabled) read(context, "snoozes").filter(::shouldKeep) else emptyList())
    preferences(context).edit().putBoolean("enabled", enabled).putBoolean("overlay", overlay).putBoolean("exact", exact).apply()
    if (!enabled) {
      write(context, "delivered", emptyList())
      context.getSystemService(NotificationManager::class.java).cancel(NOTIFICATION)
    }
    scheduleNext(context)
    return remaining.count { it.time() > now }
  }

  @Synchronized
  fun add(context: Context, alarm: JSONObject) {
    write(context, "snoozes", read(context, "snoozes").filter { it.time() > System.currentTimeMillis() - TIME_TO_LIVE } + alarm)
    scheduleNext(context)
  }

  @Synchronized
  fun restore(context: Context) {
    val cutoff = System.currentTimeMillis() - TIME_TO_LIVE
    for (key in listOf("schedule", "snoozes")) {
      write(context, key, read(context, key).filter { it.time() > cutoff })
    }
    scheduleNext(context)
  }

  @SuppressLint("ScheduleExactAlarm")
  private fun scheduleNext(context: Context) {
    val manager = context.getSystemService(AlarmManager::class.java)
    val trigger = PendingIntent.getBroadcast(context, 0, Intent(context, ScreenAlarmReceiver::class.java).setAction(ACTION_DUE), FLAGS)
    val next = queue(context).minOfOrNull { it.time() }
    if (next == null) {
      manager.cancel(trigger)
      return
    }
    val at = maxOf(next, System.currentTimeMillis() + 100)
    if (preferences(context).getBoolean("exact", false)
      && (Build.VERSION.SDK_INT < 31 || manager.canScheduleExactAlarms())) {
      try {
        val openAlarms = Intent(Intent.ACTION_VIEW, Uri.parse("leetping:///alarms")).apply {
          setClassName(context, "${context.packageName}.MainActivity")
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        }
        val info = AlarmManager.AlarmClockInfo(at, PendingIntent.getActivity(context, 1, openAlarms, FLAGS))
        manager.setAlarmClock(info, trigger)
        return
      } catch (_: SecurityException) {
        // Permission may have been revoked after checking it.
      }
    }
    manager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, trigger)
  }

  @Synchronized
  fun deliver(context: Context) {
    val now = System.currentTimeMillis()
    val next = queue(context).filter { it.time() in (now - TIME_TO_LIVE)..now }
      .minWithOrNull(compareByDescending<JSONObject> { it.has("problem") }.thenBy { it.time() })
    for (key in listOf("schedule", "snoozes")) {
      write(context, key, read(context, key).filter { it.time() > now })
    }
    scheduleNext(context)
    if (next == null || !preferences(context).getBoolean("enabled", false)) return

    val token = UUID.randomUUID().toString()
    next.put("token", token)
    next.put("expires", now + TIME_TO_LIVE)
    write(context, "delivered", read(context, "delivered").filter { it.getLong("expires") > now }.takeLast(8) + next)
    show(context, next)
  }

  @Synchronized
  fun get(context: Context, token: String?): JSONObject? =
    read(context, "delivered").firstOrNull { it.getString("token") == token && it.getLong("expires") > System.currentTimeMillis() }

  @Synchronized
  fun finish(context: Context, token: String, snooze: Boolean) {
    val alarm = get(context, token) ?: return
    val active = read(context, "delivered")
    if (snooze) {
      val at = System.currentTimeMillis() + TEN_MINUTES
      alarm.put("at", at).put("id", "snooze:$token")
      alarm.remove("token")
      alarm.remove("expires")
      add(context, alarm)
    }
    write(context, "delivered", active.filter { it.getString("token") != token })
    if (active.lastOrNull()?.getString("token") == token) {
      context.getSystemService(NotificationManager::class.java).cancel(NOTIFICATION)
    }
  }

  fun canShowFullScreen(context: Context): Boolean =
    Build.VERSION.SDK_INT < 34 || context.getSystemService(NotificationManager::class.java).canUseFullScreenIntent()

  @SuppressLint("MissingPermission")
  @Suppress("DEPRECATION")
  private fun show(context: Context, alarm: JSONObject) {
    val manager = context.getSystemService(NotificationManager::class.java)
    if (!manager.areNotificationsEnabled()) return
    val builder = if (Build.VERSION.SDK_INT >= 26) {
      val channel = NotificationChannel(CHANNEL, "Silent screen alarms", NotificationManager.IMPORTANCE_HIGH).apply {
        description = "LeetPing practice alarms without sound or vibration"
        setSound(null, null)
        enableVibration(false)
        setShowBadge(false)
        lockscreenVisibility = Notification.VISIBILITY_PUBLIC
      }
      manager.createNotificationChannel(channel)
      Notification.Builder(context, CHANNEL).setTimeoutAfter(TIME_TO_LIVE)
    } else {
      Notification.Builder(context).setPriority(Notification.PRIORITY_HIGH).setDefaults(0)
    }
    val token = alarm.getString("token")
    val intent = Intent(Intent.ACTION_VIEW, Uri.parse("leetping:///alarm-screen?id=$token")).apply {
      setClassName(context, "${context.packageName}.MainActivity")
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
    }
    val unlockedAndAwake = !context.getSystemService(KeyguardManager::class.java).isKeyguardLocked
      && context.getSystemService(PowerManager::class.java).isInteractive
    val options = if (Build.VERSION.SDK_INT >= 35) ActivityOptions.makeBasic().apply {
      setPendingIntentCreatorBackgroundActivityStartMode(ActivityOptions.MODE_BACKGROUND_ACTIVITY_START_ALLOW_ALWAYS)
    }.toBundle() else null
    val target = PendingIntent.getActivity(context, 0, intent, FLAGS, options)
    val problem = alarm.optJSONObject("problem")
    val body = problem?.optString("title")?.takeIf { it.isNotEmpty() } ?: alarm.getString("message")
    val notification = builder
      .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
      .setContentTitle(alarm.getString("headline"))
      .setContentText(body)
      .setCategory(Notification.CATEGORY_ALARM)
      .setVisibility(Notification.VISIBILITY_PUBLIC)
      .setContentIntent(target)
      .setAutoCancel(true)
      .setFullScreenIntent(target, true)
      .build()
    manager.notify(NOTIFICATION, notification)

    // Android shows a banner for a full-screen intent while the phone is unlocked.
    val canOpenOverApps = preferences(context).getBoolean("overlay", false) && Settings.canDrawOverlays(context)
    if (unlockedAndAwake && (AlarmWindow.isFocused() || canOpenOverApps)) {
      runCatching { context.startActivity(intent) }
    }
  }
}

/** Only native alarm deliveries may wake the display or show the activity over the lock screen. */
object AlarmWindow {
  private var currentActivity: WeakReference<Activity>? = null

  private fun token(intent: Intent?): String? =
    intent?.data?.takeIf { it.scheme == "leetping" && it.path == "/alarm-screen" }?.getQueryParameter("id")

  fun beforeLaunch(activity: Activity, intent: Intent?) {
    currentActivity = WeakReference(activity)
    val id = token(intent)
    if (id != null && AlarmQueue.get(activity, id) != null) {
      activity.intent = intent
      setVisible(activity, true)
    }
  }

  internal fun isFocused(): Boolean = currentActivity?.get()?.hasWindowFocus() == true

  internal fun release(activity: Activity, id: String) {
    if (token(activity.intent) == id) setVisible(activity, false)
  }

  @Suppress("DEPRECATION")
  private fun setVisible(activity: Activity, enabled: Boolean) {
    if (Build.VERSION.SDK_INT >= 27) {
      activity.setShowWhenLocked(enabled)
      activity.setTurnScreenOn(enabled)
    } else {
      val flags = WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
      if (enabled) activity.window.addFlags(flags) else activity.window.clearFlags(flags)
    }
  }
}
