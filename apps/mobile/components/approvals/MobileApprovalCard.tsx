import React from "react";
import { View, StyleSheet, Pressable } from "react-native";
import type { ApprovalRequestListItem } from "@reachinternational/types";
import { Text } from "../ui/Text";
import { Badge } from "../ui/Badge";
import { formatTinyRelativeTime } from "@reachinternational/utils";
import { ChevronRight, Clock, User } from "lucide-react-native";
import { useTheme } from "../../lib/theming";
import { haptics } from "../../lib/haptics";

export interface MobileApprovalCardProps {
  item: ApprovalRequestListItem;
  onPress: (item: ApprovalRequestListItem) => void;
}

export const MobileApprovalCard = React.memo(function MobileApprovalCard({
  item,
  onPress,
}: MobileApprovalCardProps) {
  const { colors } = useTheme();

  const handlePress = () => {
    haptics.select();
    onPress(item);
  };

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.canvasElevated,
          borderColor: colors.hairline,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${item.type_label}: ${item.summary}`}
    >
      <View style={styles.content}>
        <View style={styles.badgeRow}>
          <Badge variant="outline">
            <Text variant="micro">{item.type_label}</Text>
          </Badge>
          <Badge
            variant={
              item.status === "approved"
                ? "default"
                : item.status === "rejected"
                ? "destructive"
                : "secondary"
            }
          >
            <Text variant="micro">{item.status.toUpperCase()}</Text>
          </Badge>
        </View>

        <Text variant="heading" numberOfLines={2} style={styles.title}>
          {item.summary}
        </Text>

        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <User size={12} color={colors.mute} />
            <Text variant="caption" numberOfLines={1}>
              {item.requester_name || "System"}
            </Text>
          </View>
          <View style={styles.metaItem}>
            <Clock size={12} color={colors.mute} />
            <Text variant="caption">{formatTinyRelativeTime(item.created_at)}</Text>
          </View>
        </View>
      </View>

      <View style={styles.chevronContainer}>
        <ChevronRight size={18} color={colors.mute} />
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
    minHeight: 64,
  },
  content: {
    flex: 1,
    marginRight: 8,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  title: {
    marginBottom: 6,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  chevronContainer: {
    justifyContent: "center",
    alignItems: "center",
    width: 24,
    height: 44,
  },
});
