import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, FlatList, StyleSheet,
  RefreshControl, ActivityIndicator, TouchableOpacity,
} from 'react-native'
import { getNotes } from '../../lib/api'
import { colors, font, spacing, radius, shadow } from '../../lib/theme'

export default function NotesScreen() {
  const [notes,      setNotes]      = useState<any[]>([])
  const [loading,    setLoading]    = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [tab,        setTab]        = useState<'mine' | 'shared'>('mine')

  const load = useCallback(async () => {
    try {
      const params = tab === 'shared' ? { shared: '1' } : {}
      const data = await getNotes(params)
      setNotes(Array.isArray(data) ? data : [])
    } finally { setLoading(false); setRefreshing(false) }
  }, [tab])

  useEffect(() => { setLoading(true); load() }, [load])

  function renderNote({ item: n }: { item: any }) {
    const preview = n.content?.slice(0, 140) || ''
    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <Text style={styles.date}>{n.note_date}</Text>
          {n.is_shared && (
            <View style={styles.sharedBadge}><Text style={styles.sharedText}>SHARED</Text></View>
          )}
        </View>
        {preview ? (
          <Text style={styles.preview} numberOfLines={3}>{preview}</Text>
        ) : (
          <Text style={styles.noContent}>No content</Text>
        )}
        {n.tickers?.length > 0 && (
          <View style={styles.tickers}>
            {n.tickers.slice(0, 6).map((t: string) => (
              <View key={t} style={styles.tickerChip}>
                <Text style={styles.tickerText}>{t}</Text>
              </View>
            ))}
          </View>
        )}
        {n.image_urls?.length > 0 && (
          <Text style={styles.imgCount}>📷 {n.image_urls.length} image{n.image_urls.length > 1 ? 's' : ''}</Text>
        )}
      </View>
    )
  }

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.accent} size="large" /></View>

  return (
    <View style={styles.container}>
      {/* Tabs */}
      <View style={styles.tabBar}>
        {(['mine', 'shared'] as const).map(t => (
          <TouchableOpacity key={t} style={[styles.tab, tab === t && styles.tabActive]} onPress={() => setTab(t)}>
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === 'mine' ? 'MY NOTES' : 'SHARED'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={notes}
        keyExtractor={n => n.id}
        renderItem={renderNote}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} tintColor={colors.accent} />
        }
        ListEmptyComponent={
          <View style={styles.center}>
            <Text style={styles.emptyText}>No notes yet</Text>
          </View>
        }
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },

  tabBar: {
    flexDirection: 'row', gap: spacing.sm,
    padding: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  tab: { paddingHorizontal: spacing.md, paddingVertical: 5, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border },
  tabActive:     { backgroundColor: colors.accent, borderColor: colors.accent },
  tabText:       { fontFamily: 'DMmono', fontSize: font.size.xs, color: colors.muted, letterSpacing: 0.5 },
  tabTextActive: { color: colors.white, fontWeight: '700' },

  card: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md, ...shadow.sm,
  },
  cardTop:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  date:       { fontFamily: 'DMmono', fontSize: font.size.sm, fontWeight: '700', color: colors.accent },
  sharedBadge:{ backgroundColor: '#dcfce7', paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.sm, borderWidth: 1, borderColor: '#bbf7d0' },
  sharedText: { fontFamily: 'DMmono', fontSize: font.size.xs, color: colors.green, fontWeight: '700' },
  preview:    { fontFamily: 'LibreBaskerville', fontSize: font.size.md, color: colors.text, lineHeight: 20 },
  noContent:  { fontFamily: 'DMmono', fontSize: font.size.sm, color: colors.muted },
  tickers:    { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.sm },
  tickerChip: { backgroundColor: colors.accentDim, paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.sm, borderWidth: 1, borderColor: '#bae6fd' },
  tickerText: { fontFamily: 'DMmono', fontSize: font.size.xs, color: colors.accent2 },
  imgCount:   { fontFamily: 'DMmono', fontSize: font.size.xs, color: colors.muted, marginTop: spacing.sm },
  emptyText:  { fontFamily: 'LibreBaskerville', fontSize: font.size.xxl, color: colors.border2 },
})
