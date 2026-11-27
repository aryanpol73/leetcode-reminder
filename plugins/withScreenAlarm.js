const { withMainActivity } = require('expo/config-plugins');

module.exports = function withScreenAlarm(config) {
  return withMainActivity(config, (mod) => {
    const source = mod.modResults.contents;
    const classStart = 'class MainActivity : ReactActivity() {';
    const superOnCreate = '    super.onCreate(null)';
    if (!source.includes('AlarmWindow.beforeLaunch')) {
      if (!source.includes(classStart) || !source.includes(superOnCreate)) {
        throw new Error('Screen alarms require the Expo Kotlin MainActivity template.');
      }
      mod.modResults.contents = source
        .replace(classStart, `${classStart}
  override fun onNewIntent(intent: android.content.Intent) {
    expo.modules.leetpingscreenalarm.AlarmWindow.beforeLaunch(this, intent)
    super.onNewIntent(intent)
  }
`)
        .replace(superOnCreate, `    expo.modules.leetpingscreenalarm.AlarmWindow.beforeLaunch(this, intent)
${superOnCreate}`);
    }
    return mod;
  });
};
