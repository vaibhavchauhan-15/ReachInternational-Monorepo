import { Platform, Pressable } from 'react-native';
import Animated from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * This component is used to wrap animated views that should only be animated on native.
 */
function NativeOnlyAnimatedView(
  props:
    | (React.ComponentProps<typeof Animated.View> &
        React.RefAttributes<typeof Animated.View> & { as?: 'View' })
    | (React.ComponentProps<typeof AnimatedPressable> &
        React.RefAttributes<typeof AnimatedPressable> & { as: 'Pressable' })
) {
  if (Platform.OS === 'web') {
    return <>{props.children as React.ReactNode}</>;
  } else {
    if (props.as === 'Pressable') {
      return <AnimatedPressable {...(props as any)} />;
    }
    return <Animated.View {...(props as any)} />;
  }
}

export { NativeOnlyAnimatedView };
