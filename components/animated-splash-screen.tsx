import React, { useEffect } from 'react';
import { StyleSheet, View, Text, Dimensions } from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withRepeat, 
  withTiming, 
  Easing 
} from 'react-native-reanimated';
import Svg, { Rect, Circle, G, Path } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

const SubwayCharacter = () => {
  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, {
        duration: 1000,
        easing: Easing.linear,
      }),
      -1,
      false
    );
  }, []);

  const wheelStyle = useAnimatedStyle(() => {
    return {
      transform: [{ rotate: `${rotation.value}deg` }],
    };
  });

  return (
    <View style={styles.characterContainer}>
      <Svg width="160" height="180" viewBox="0 0 160 180">
        {/* Body Outline */}
        <Rect
          x="20"
          y="35"
          width="120"
          height="125"
          rx="35"
          fill="white"
          stroke="#1E3A5F"
          strokeWidth="4"
        />
        
        {/* Face Display Area */}
        <Rect
          x="32"
          y="70"
          width="96"
          height="55"
          rx="18"
          fill="#F5F8FA"
          stroke="#E1E8ED"
          strokeWidth="1"
        />
        
        {/* Eyes */}
        <Circle cx="58" cy="98" r="3.5" fill="#1E3A5F" />
        <Circle cx="102" cy="98" r="3.5" fill="#1E3A5F" />
        
        {/* Mouth */}
        <Path
          d="M75 112 H85"
          stroke="#1E3A5F"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        
        {/* Top Badge (역앞) */}
        <G>
          <Rect
            x="45"
            y="20"
            width="70"
            height="30"
            rx="15"
            fill="#2D6A4F"
          />
        </G>

        {/* Small Yellow Dot on the right */}
        <Circle cx="140" cy="75" r="5.5" fill="#FFD700" />
      </Svg>

      {/* Text on Badge - positioned absolutely over the SVG */}
      <View style={styles.badgeTextContainer}>
        <Text style={styles.badgeText}>역앞</Text>
      </View>

      {/* Wheels - Positioned to overlap the bottom edge */}
      <View style={styles.wheelsContainer}>
        <Animated.View style={[styles.wheel, wheelStyle]}>
          <Svg width="34" height="34" viewBox="0 0 34 34">
            <Circle cx="17" cy="17" r="15" fill="#1E3A5F" />
            <Path d="M17 6 V12 M17 22 V28 M6 17 H12 M22 17 H28" stroke="white" strokeWidth="2.5" strokeLinecap="round" opacity="0.6" />
          </Svg>
        </Animated.View>
        <Animated.View style={[styles.wheel, wheelStyle]}>
          <Svg width="34" height="34" viewBox="0 0 34 34">
            <Circle cx="17" cy="17" r="15" fill="#1E3A5F" />
            <Path d="M17 6 V12 M17 22 V28 M6 17 H12 M22 17 H28" stroke="white" strokeWidth="2.5" strokeLinecap="round" opacity="0.6" />
          </Svg>
        </Animated.View>
      </View>
    </View>
  );
};

interface AnimatedSplashScreenProps {
  isExiting?: boolean;
}

export const AnimatedSplashScreen: React.FC<AnimatedSplashScreenProps> = ({ isExiting }) => {
  const opacity = useSharedValue(1);
  const contentOpacity = useSharedValue(0);
  const contentScale = useSharedValue(0.9);

  useEffect(() => {
    // 캐릭터가 스르륵 나타나는 효과
    contentOpacity.value = withTiming(1, { duration: 800 });
    contentScale.value = withTiming(1, { 
      duration: 800, 
      easing: Easing.out(Easing.back(1.5)) 
    });

    if (isExiting) {
      opacity.value = withTiming(0, {
        duration: 500,
        easing: Easing.out(Easing.exp),
      });
    }
  }, [isExiting]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      opacity: opacity.value,
    };
  });

  const contentAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: contentOpacity.value,
      transform: [{ scale: contentScale.value }],
    };
  });

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      <LinearGradient
        colors={['#E6F4FE', '#FFFFFF', '#F0F9FF']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      
      <Animated.View style={[styles.content, contentAnimatedStyle]}>
        <SubwayCharacter />
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  characterContainer: {
    width: 160,
    height: 180,
    alignItems: 'center',
  },
  badgeTextContainer: {
    position: 'absolute',
    top: 20,
    width: 70,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  wheelsContainer: {
    position: 'absolute',
    bottom: 10,
    flexDirection: 'row',
    width: 90,
    justifyContent: 'space-between',
    paddingHorizontal: 0,
  },
  wheel: {
    width: 34,
    height: 34,
  },
});
