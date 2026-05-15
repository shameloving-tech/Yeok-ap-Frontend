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
          y="40"
          width="120"
          height="120"
          rx="30"
          fill="white"
          stroke="#1E3A5F"
          strokeWidth="4"
        />
        
        {/* Face Display Area */}
        <Rect
          x="35"
          y="75"
          width="90"
          height="50"
          rx="15"
          fill="#F5F8FA"
          stroke="#E1E8ED"
          strokeWidth="1"
        />
        
        {/* Eyes */}
        <Circle cx="60" cy="100" r="3" fill="#1E3A5F" />
        <Circle cx="100" cy="100" r="3" fill="#1E3A5F" />
        
        {/* Mouth */}
        <Path
          d="M75 110 H85"
          stroke="#1E3A5F"
          strokeWidth="2"
          strokeLinecap="round"
        />
        
        {/* Top Badge (역앞) */}
        <G>
          <Rect
            x="45"
            y="25"
            width="70"
            height="30"
            rx="15"
            fill="#2D6A4F"
          />
        </G>

        {/* Small Yellow Dot on the right */}
        <Circle cx="140" cy="80" r="5" fill="#FFD700" />
      </Svg>

      {/* Text on Badge - positioned absolutely over the SVG */}
      <View style={styles.badgeTextContainer}>
        <Text style={styles.badgeText}>역앞</Text>
      </View>

      {/* Wheels */}
      <View style={styles.wheelsContainer}>
        <Animated.View style={[styles.wheel, wheelStyle]}>
          <Svg width="30" height="30" viewBox="0 0 30 30">
            <Circle cx="15" cy="15" r="13" fill="#1E3A5F" />
            <Path d="M15 5 V10 M15 20 V25 M5 15 H10 M20 15 H25" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
          </Svg>
        </Animated.View>
        <Animated.View style={[styles.wheel, wheelStyle]}>
          <Svg width="30" height="30" viewBox="0 0 30 30">
            <Circle cx="15" cy="15" r="13" fill="#1E3A5F" />
            <Path d="M15 5 V10 M15 20 V25 M5 15 H10 M20 15 H25" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
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

  useEffect(() => {
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

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      <LinearGradient
        colors={['#E6F4FE', '#FFFFFF', '#F0F9FF']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      
      <View style={styles.content}>
        <SubwayCharacter />
      </View>
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
  shadow: {
    position: 'absolute',
    bottom: -10,
    width: 100,
    height: 10,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 50,
  },
  badgeTextContainer: {
    position: 'absolute',
    top: 25,
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
    bottom: 20,
    flexDirection: 'row',
    width: 100,
    justifyContent: 'space-between',
    paddingHorizontal: 5,
  },
  wheel: {
    width: 30,
    height: 30,
  },
});
