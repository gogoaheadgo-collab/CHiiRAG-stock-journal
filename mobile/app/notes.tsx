import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, RefreshControl, ActivityIndicator,
} from 'react-native'
import { getNotes } from '../../lib/api'
import { colors, font, spacing, radius } from '../../lib/theme'

type Note = {
  id: string
  note_date: string
  content: string
  tickers: string[]
  is_shared: boolean
  image_urls?: string[]
}

export default function NotesScreen() {
  const [notes,      setNotes]      = useState<Note[]>([])
  const [loading,    setLoading]    = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    try {
      const data = await getNotes()
      setNotes(data || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  function renderNote({ item: n }: { item: Note }) {
    const preview = n.content?.slice(0, 120) || ''
    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <Text style={styles.date}>{n.note_date}</Text>
          {n.is_shared && (
            <View style={styles.sharedBadge}>
              <Text style={styles.sharedText}>SHARED</Text>
            </View>
          )}
        </View>
        {preview ? (
          <Text style={styles.preview} numberOfLines={3}>{preview}</Text>
        ) : (
          <Text style={styles.empty}>No content</Text>
        )}
        {n.tickers?.length > 0 && (
          <View style={styles.tickers}>
            {n.tickers.slice(0, 5).map(t => (
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

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={notes}
        keyExtractor={n => n.id}
        renderItem={renderNote}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 100 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load() }}
            tintColor={colors.accent}
          />
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
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  cardTop:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  date:       { fontFamily: font.mono, fontSize: font.size.sm, fontWeight: font.weight.bold, color: colors.accent },
  sharedBadge:{ backgroundColor: colors.green + '22', paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.sm },
  sharedText: { fontFamily: font.mono, fontSize: font.size.xs, color: colors.green, letterSpacing: 1 },
  preview:    { fontFamily: font.mono, fontSize: font.size.md, color: colors.textSecondary, lineHeight: 20 },
  empty:      { fontFamily: font.mono, fontSize: font.size.md, color: colors.textMuted },
  tickers:    { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.sm },
  tickerChip: { backgroundColor: colors.accent + '18', paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.accent + '44' },
  tickerText: { fontFamily: font.mono, fontSize: font.size.xs, color: colors.accent },
  imgCount:   { fontFamily: font.mono, fontSize: font.size.xs, color: colors.textMuted, marginTop: spacing.sm },
  emptyText:  { fontFamily: font.mono, fontSize: font.size.md, color: colors.textMuted },
})
