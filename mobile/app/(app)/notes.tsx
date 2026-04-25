import { useEffect, useState, useCallback } from 'react'
import { View, Text, FlatList, StyleSheet, RefreshControl, ActivityIndicator, TouchableOpacity } from 'react-native'
import { getNotes } from '../../lib/api'
import { colors, font, spacing, radius } from '../../lib/theme'

export default function NotesScreen() {
  const [notes,      setNotes]      = useState<any[]>([])
  const [loading,    setLoading]    = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [tab,        setTab]        = useState<'mine' | 'shared'>('mine')

  const load = useCallback(async () => {
    try {
      const data = await getNotes(tab === 'shared' ? { shared: '1' } : {})
      setNotes(Array.isArray(data) ? data : [])
    } finally { setLoading(false); setRefreshing(false) }
  }, [tab])

  useEffect(() => { setLoading(true); load() }, [load])

  if (loading) return <View style={s.center}><ActivityIndicator color={colors.accent} size="large" /></View>

  return (
    <View style={s.container}>
      <View style={s.tabBar}>
        {(['mine', 'shared'] as const).map(t => (
          <TouchableOpacity key={t} style={[s.tab, tab === t && s.tabActive]} onPress={() => setTab(t)}>
            <Text style={[s.tabText, tab === t && s.tabTextActive]}>
              {t === 'mine' ? 'MY NOTES' : 'SHARED BY ADMIN'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={notes}
        keyExtractor={n => n.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} tintColor={colors.accent} />}
        renderItem={({ item: n }) => (
          <View style={s.card}>
            <View style={s.cardHead}>
              <Text style={s.date}>{n.note_date}</Text>
              {n.is_shared && (
                <View style={s.sharedBadge}><Text style={s.sharedText}>SHARED</Text></View>
              )}
            </View>
            {n.content ? (
              <Text style={s.preview} numberOfLines={4}>{n.content}</Text>
            ) : (
              <Text style={s.empty}>No content</Text>
            )}
            {n.tickers?.length > 0 && (
              <View style={s.tickers}>
                {n.tickers.map((t: string) => (
                  <View key={t} style={s.chip}><Text style={s.chipText}>{t}</Text></View>
                ))}
              </View>
            )}
            {n.image_urls?.length > 0 && (
              <Text style={s.images}>📷 {n.image_urls.length} image{n.image_urls.length > 1 ? 's' : ''} attached</Text>
            )}
          </View>
        )}
        ListEmptyComponent={
          <View style={s.center}>
            <Text style={s.emptyBig}>No notes yet</Text>
          </View>
        }
      />
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  list:      { padding: spacing.lg, paddingBottom: 120 },

  tabBar: { flexDirection: 'row', gap: spacing.sm, padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  tab:         { flex: 1, paddingVertical: spacing.sm, borderRadius: 20, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  tabActive:   { backgroundColor: colors.accent, borderColor: colors.accent },
  tabText:     { fontSize: font.size.sm, fontWeight: '600', color: colors.muted },
  tabTextActive: { color: colors.white },

  card:     { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md, borderLeftWidth: 4, borderLeftColor: colors.accent },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  date:     { fontSize: font.size.xl, fontWeight: '800', color: colors.accent },
  sharedBadge: { backgroundColor: '#dcfce7', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20, borderWidth: 1, borderColor: '#bbf7d0' },
  sharedText:  { fontSize: font.size.xs, color: colors.green, fontWeight: '700' },
  preview:  { fontSize: font.size.md, color: colors.text, lineHeight: 22 },
  empty:    { fontSize: font.size.md, color: colors.muted },
  tickers:  { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.md },
  chip:     { backgroundColor: colors.accentDim, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1, borderColor: '#bae6fd' },
  chipText: { fontSize: font.size.sm, color: colors.accent2, fontWeight: '600' },
  images:   { fontSize: font.size.sm, color: colors.muted, marginTop: spacing.sm },
  emptyBig: { fontSize: font.size.xl, color: colors.border2, fontWeight: '700' },
})
