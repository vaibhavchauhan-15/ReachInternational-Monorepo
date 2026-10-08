package com.reachinternational.modules.haptics

import android.os.Build
import android.view.HapticFeedbackConstants
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ReachHapticsModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ReachHaptics")

    Function("perform") { kind: String ->
      val view = appContext.currentActivity?.window?.decorView ?: return@Function false
      val sdk = Build.VERSION.SDK_INT
      val c = when (kind) {
        "tap"        -> HapticFeedbackConstants.CLOCK_TICK
        "select"     -> if (sdk >= 34) HapticFeedbackConstants.SEGMENT_TICK else HapticFeedbackConstants.CLOCK_TICK
        "toggleOn"   -> if (sdk >= 34) HapticFeedbackConstants.TOGGLE_ON else HapticFeedbackConstants.CLOCK_TICK
        "toggleOff"  -> if (sdk >= 34) HapticFeedbackConstants.TOGGLE_OFF else HapticFeedbackConstants.CLOCK_TICK
        "confirm"    -> if (sdk >= 30) HapticFeedbackConstants.CONFIRM else HapticFeedbackConstants.CONTEXT_CLICK
        "reject"     -> if (sdk >= 30) HapticFeedbackConstants.REJECT else HapticFeedbackConstants.LONG_PRESS
        "longPress"  -> HapticFeedbackConstants.LONG_PRESS
        "dragStart"  -> if (sdk >= 34) HapticFeedbackConstants.DRAG_START else HapticFeedbackConstants.CLOCK_TICK
        "dragEnd"    -> if (sdk >= 30) HapticFeedbackConstants.GESTURE_END else HapticFeedbackConstants.CLOCK_TICK
        "threshold"  -> if (sdk >= 34) HapticFeedbackConstants.SEGMENT_FREQUENT_TICK else HapticFeedbackConstants.CLOCK_TICK
        else -> return@Function false
      }
      view.performHapticFeedback(c)
    }
  }
}
