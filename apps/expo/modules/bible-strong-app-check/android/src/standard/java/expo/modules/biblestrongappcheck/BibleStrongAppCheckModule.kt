package expo.modules.biblestrongappcheck

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class BibleStrongAppCheckModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("BibleStrongAppCheck")
    Constant("provider") { "playIntegrity" }
  }
}
