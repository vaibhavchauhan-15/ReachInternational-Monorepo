/**
 * ServiceCentric Mobile — Virtualized List Component (Phase 28)
 * High-performance virtualized list wrapper with optimized item batching,
 * clipped subview removal, and pull-to-refresh control.
 */

import React from 'react';
import { FlatList, FlatListProps, StyleSheet, View } from 'react-native';
import { OPTIMIZED_FLATLIST_PROPS } from '../../lib/performance';
import { EmptyState } from './EmptyState';

export interface OptimizedListProps<T> extends FlatListProps<T> {
  emptyTitle?: string;
  emptyDescription?: string;
}

export function OptimizedList<T>({
  data,
  renderItem,
  keyExtractor,
  emptyTitle = 'No Items Found',
  emptyDescription = 'There are no records matching your current filter.',
  contentContainerStyle,
  ...props
}: OptimizedListProps<T>) {
  return (
    <FlatList
      data={data}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      ListEmptyComponent={<EmptyState title={emptyTitle} description={emptyDescription} />}
      contentContainerStyle={[styles.content, contentContainerStyle]}
      {...OPTIMIZED_FLATLIST_PROPS}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 30,
  },
});
