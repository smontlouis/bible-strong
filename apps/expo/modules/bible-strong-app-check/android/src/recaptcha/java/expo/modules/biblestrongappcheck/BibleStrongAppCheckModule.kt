package expo.modules.biblestrongappcheck

import android.content.pm.PackageManager
import com.google.firebase.FirebaseApp
import com.google.firebase.appcheck.FirebaseAppCheck
import com.google.firebase.appcheck.recaptcha.RecaptchaAppCheckProviderFactory
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class BibleStrongAppCheckModule : Module() {
  private var appCheck: FirebaseAppCheck? = null

  override fun definition() = ModuleDefinition {
    Name("BibleStrongAppCheck")
    Constant("provider") { "recaptchaEnterprise" }

    AsyncFunction("initialize") { appName: String ->
      if (appCheck == null) {
        val context = requireNotNull(appContext.reactContext)
        val metadata = context.packageManager.getApplicationInfo(
          context.packageName, PackageManager.GET_META_DATA
        ).metaData
        val siteKey = metadata?.getString("app.biblestrong.appcheck.recaptcha.siteKey")
        check(!siteKey.isNullOrBlank()) { "RESOURCE_APP_CHECK_RECAPTCHA_SITE_KEY_MISSING" }
        val instance = FirebaseAppCheck.getInstance(FirebaseApp.getInstance(appName))
        instance.installAppCheckProviderFactory(RecaptchaAppCheckProviderFactory.getInstance(siteKey))
        instance.setTokenAutoRefreshEnabled(true)
        appCheck = instance
      }
    }

    AsyncFunction("getToken") { forceRefresh: Boolean, promise: Promise ->
      val instance = appCheck
      if (instance == null) {
        promise.reject("appCheck/not-initialized", "RESOURCE_APP_CHECK_NOT_INITIALIZED", null)
      } else {
        // Keep Firebase's cache, expiry and retry policy. No custom tokens or token storage.
        instance.getAppCheckToken(forceRefresh)
          .addOnSuccessListener { result -> promise.resolve(mapOf("token" to result.token)) }
          .addOnFailureListener { error ->
            promise.reject("appCheck/token-error", error.message, error)
          }
      }
    }
  }
}
