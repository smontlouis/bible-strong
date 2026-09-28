package expo.modules.biblestrongappcheck

import android.content.pm.PackageManager
import com.google.android.recaptcha.RecaptchaException
import com.google.firebase.FirebaseApp
import com.google.firebase.appcheck.FirebaseAppCheck
import com.google.firebase.appcheck.recaptcha.RecaptchaAppCheckProviderFactory
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class BibleStrongAppCheckModule : Module() {
  private var appCheck: FirebaseAppCheck? = null

  // Redact before truncating so a long JWT cannot become an unrecognizable fragment.
  private fun safeMessage(error: Throwable): String = (error.message ?: "App Check failed")
    .replace(Regex("\\beyJ[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+\\b"), "[REDACTED_TOKEN]")
    .replace(Regex("\\bBearer\\s+[A-Za-z0-9._~+/-]+=*", RegexOption.IGNORE_CASE), "Bearer [REDACTED]")
    .replace(Regex("\\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}\\b", RegexOption.IGNORE_CASE), "[REDACTED_EMAIL]")
    .take(500)

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

    // Additive bridge: older JS keeps getToken; new JS can read bounded native causes.
    AsyncFunction("getTokenWithDiagnostics") { forceRefresh: Boolean, promise: Promise ->
      val instance = appCheck
      if (instance == null) {
        promise.reject("appCheck/not-initialized", "RESOURCE_APP_CHECK_NOT_INITIALIZED", null)
      } else {
        instance.getAppCheckToken(forceRefresh)
          .addOnSuccessListener { result ->
            promise.resolve(mapOf("token" to result.token, "expiresAtMillis" to result.expireTimeMillis))
          }
          .addOnFailureListener { error ->
            val causes = mutableListOf<Map<String, String>>()
            var current: Throwable? = error
            while (current != null && causes.size < 4) {
              val cause = current
              val diagnostic = mutableMapOf("name" to cause.javaClass.simpleName, "message" to safeMessage(cause))
              if (cause is RecaptchaException) diagnostic["nativeCode"] = cause.errorCode.name
              causes.add(diagnostic)
              current = cause.cause
              if (current === cause) break
            }
            promise.resolve(mapOf("error" to mapOf("code" to "appCheck/token-error", "causes" to causes)))
          }
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
