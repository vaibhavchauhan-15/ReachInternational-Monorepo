# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# react-native-reanimated
-keep class com.swmansion.reanimated.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }

# Add any project specific keep options here:


# Reach International - Proguard / R8 Optimization Keep Rules
-keepattributes *Annotation*,Signature,InnerClasses,EnclosingMethod
-keepattributes LineNumberTable,SourceFile

# React Native & TurboModules
-keep class com.facebook.react.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }
-keep class com.facebook.jni.** { *; }

# React Native Reanimated
-keep class com.swmansion.reanimated.** { *; }

# Expo Modules & SecureStore
-keep class expo.modules.** { *; }
-keep class expo.modules.securestore.** { *; }

# Network & Storage
-keep class com.reactnativecommunity.netinfo.** { *; }
-keep class com.reactnativecommunity.asyncstorage.** { *; }

# Sentry
-keep class io.sentry.** { *; }
