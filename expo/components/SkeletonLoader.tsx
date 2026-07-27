import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, ViewStyle } from 'react-native';
import { Colors } from '@/constants/colors';

interface SkeletonBoxProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export function SkeletonBox({ width = '100%', height = 16, borderRadius = 8, style }: SkeletonBoxProps) {
  const opacity = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.85,
          duration: 850,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.35,
          duration: 850,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        {
          width: width as any,
          height,
          borderRadius,
          backgroundColor: Colors.surfaceMuted,
          opacity,
        },
        style,
      ]}
    />
  );
}

export function VendorCardSkeleton() {
  return (
    <View style={skeletonStyles.vendorCard}>
      <SkeletonBox height={168} borderRadius={16} style={skeletonStyles.vendorImage} />
      <View style={skeletonStyles.vendorInfo}>
        <SkeletonBox width="68%" height={17} borderRadius={6} />
        <SkeletonBox width="48%" height={13} borderRadius={5} style={{ marginTop: 7 }} />
        <SkeletonBox width="36%" height={13} borderRadius={5} style={{ marginTop: 5 }} />
      </View>
    </View>
  );
}

export function VendorCardSkeletonCompact() {
  return (
    <View style={skeletonStyles.vendorCardCompact}>
      <SkeletonBox height={80} width={80} borderRadius={12} />
      <View style={skeletonStyles.vendorCardCompactInfo}>
        <SkeletonBox width="60%" height={17} borderRadius={6} />
        <SkeletonBox width="45%" height={13} borderRadius={5} style={{ marginTop: 7 }} />
        <SkeletonBox width="35%" height={13} borderRadius={5} style={{ marginTop: 5 }} />
      </View>
    </View>
  );
}

export function OrderCardSkeleton() {
  return (
    <View style={skeletonStyles.orderCard}>
      <View style={skeletonStyles.orderCardHeader}>
        <View style={skeletonStyles.orderCardHeaderLeft}>
          <SkeletonBox width={36} height={36} borderRadius={10} />
          <SkeletonBox width="50%" height={17} borderRadius={6} />
        </View>
        <SkeletonBox width={72} height={24} borderRadius={12} />
      </View>
      <SkeletonBox width="38%" height={12} borderRadius={5} style={{ marginBottom: 7 }} />
      <SkeletonBox width="58%" height={12} borderRadius={5} style={{ marginBottom: 14 }} />
      <View style={skeletonStyles.orderCardFooter}>
        <SkeletonBox width="28%" height={12} borderRadius={5} />
        <SkeletonBox width="22%" height={22} borderRadius={6} />
      </View>
    </View>
  );
}

export function ChatRowSkeleton() {
  return (
    <View style={skeletonStyles.chatRow}>
      <SkeletonBox width={50} height={50} borderRadius={25} />
      <View style={skeletonStyles.chatRowContent}>
        <View style={skeletonStyles.chatRowTop}>
          <SkeletonBox width="44%" height={15} borderRadius={6} />
          <SkeletonBox width="13%" height={12} borderRadius={5} />
        </View>
        <SkeletonBox width="28%" height={11} borderRadius={5} style={{ marginTop: 5 }} />
        <SkeletonBox width="70%" height={12} borderRadius={5} style={{ marginTop: 5 }} />
      </View>
    </View>
  );
}

export function VendorListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <View style={{ gap: 20, padding: 20 }}>
      {Array.from({ length: count }).map((_, i) => (
        <VendorCardSkeletonCompact key={i} />
      ))}
    </View>
  );
}

export function OrderListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <View style={{ gap: 12, padding: 16 }}>
      {Array.from({ length: count }).map((_, i) => (
        <OrderCardSkeleton key={i} />
      ))}
    </View>
  );
}

export function ChatListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <View>
      {Array.from({ length: count }).map((_, i) => (
        <ChatRowSkeleton key={i} />
      ))}
    </View>
  );
}

export function ExploreSkeleton() {
  return (
    <View style={{ paddingTop: 8 }}>
      <View style={{ paddingHorizontal: 20, marginBottom: 20 }}>
        <SkeletonBox width="40%" height={22} borderRadius={7} style={{ marginBottom: 12 }} />
        <View style={{ flexDirection: 'row', gap: 14 }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <View key={i} style={{ alignItems: 'center', width: 72 }}>
              <SkeletonBox width={66} height={66} borderRadius={33} />
              <SkeletonBox width={54} height={10} borderRadius={4} style={{ marginTop: 7 }} />
            </View>
          ))}
        </View>
      </View>
      <View style={{ paddingHorizontal: 20, marginBottom: 8 }}>
        <SkeletonBox width="50%" height={22} borderRadius={7} style={{ marginBottom: 12 }} />
      </View>
      <View style={{ flexDirection: 'row', gap: 16, paddingHorizontal: 20 }}>
        {Array.from({ length: 3 }).map((_, i) => (
          <View key={i} style={{ width: 180 }}>
            <SkeletonBox width={180} height={158} borderRadius={16} />
            <SkeletonBox width={130} height={15} borderRadius={5} style={{ marginTop: 10 }} />
            <SkeletonBox width={90} height={12} borderRadius={5} style={{ marginTop: 5 }} />
          </View>
        ))}
      </View>
    </View>
  );
}

const skeletonStyles = StyleSheet.create({
  vendorCard: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  vendorImage: {
    width: '100%',
  },
  vendorInfo: {
    padding: 14,
    gap: 0,
  },
  vendorCardCompact: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 14,
    gap: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  vendorCardCompactInfo: {
    flex: 1,
    gap: 0,
  },
  orderCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  orderCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 10,
  },
  orderCardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  orderCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSoft,
  },
  chatRowContent: {
    flex: 1,
    gap: 0,
  },
  chatRowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
