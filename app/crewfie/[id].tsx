// app/crewfie/[id].tsx
// ─────────────────────────────────────────────────────────────────────
// Crewfie Detail Screen
// Deep-linked from crewfie_like and crewfie_comment notifications.
// Shows a single post with its photo, caption, likes, and comments.
// Does NOT modify CrewfiesFeed or any existing feed code.
// ─────────────────────────────────────────────────────────────────────

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { db } from '@/config/firebase';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { notifyCrewfikeLike, notifyCrewfieComment } from '@/utils/notifications';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Post = {
  id: string;
  userId: string;
  userName: string;
  userAirline: string;
  userPhoto: string | null;
  content: string | null;
  photoURL: string;
  location: string | null;
  likes: string[];
  createdAt: any;
};

type Comment = {
  id: string;
  userId: string;
  userName: string;
  userPhoto: string | null;
  text: string;
  createdAt: any;
};

export default function CrewfieDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const commentInputRef = useRef<TextInput>(null);

  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [currentUserName, setCurrentUserName] = useState('');
  const [currentUserPhoto, setCurrentUserPhoto] = useState<string | null>(null);

  // ─── Load current user profile data (for posting comments) ─────────

  useEffect(() => {
    if (!user?.uid) return;

    const unsubscribe = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setCurrentUserName(data.displayName || 'Unknown');
        setCurrentUserPhoto(data.photoURL || null);
      }
    });

    return () => unsubscribe();
  }, [user]);

  // ─── Listen to the post document (real-time likes updates) ─────────

  useEffect(() => {
    if (!id) return;

    const unsubscribe = onSnapshot(doc(db, 'posts', id), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setPost({
          id: docSnap.id,
          userId: data.userId,
          userName: data.userName || 'Unknown',
          userAirline: data.userAirline || '',
          userPhoto: data.userPhoto || null,
          content: data.content || null,
          photoURL: data.photoURL,
          location: data.location || null,
          likes: data.likes || [],
          createdAt: data.createdAt,
        });
        setNotFound(false);
      } else {
        setNotFound(true);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [id]);

  // ─── Listen to comments subcollection ──────────────────────────────

  useEffect(() => {
    if (!id) return;

    const commentsQuery = query(
      collection(db, 'posts', id, 'comments'),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(commentsQuery, (snapshot) => {
      const loaded: Comment[] = snapshot.docs.map((doc) => ({
        id: doc.id,
        userId: doc.data().userId,
        userName: doc.data().userName || 'Unknown',
        userPhoto: doc.data().userPhoto || null,
        text: doc.data().text || '',
        createdAt: doc.data().createdAt,
      }));
      setComments(loaded);
    });

    return () => unsubscribe();
  }, [id]);

  // ─── Like / Unlike ────────────────────────────────────────────────

  const isLiked = post?.likes?.includes(user?.uid || '') || false;

  const handleLike = async () => {
    if (!user?.uid || !post) return;

    try {
      const postRef = doc(db, 'posts', post.id);

      if (isLiked) {
        await updateDoc(postRef, { likes: arrayRemove(user.uid) });
      } else {
        await updateDoc(postRef, { likes: arrayUnion(user.uid) });

        // Send notification to post owner (function handles self-like guard)
        await notifyCrewfikeLike(
          post.userId,
          user.uid,
          currentUserName,
          post.id,
          post.content?.slice(0, 40) || undefined
        );
      }
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  };

  // ─── Add Comment ──────────────────────────────────────────────────

  const handleAddComment = async () => {
    if (!user?.uid || !post || !commentText.trim()) return;

    setSubmittingComment(true);

    try {
      await addDoc(collection(db, 'posts', post.id, 'comments'), {
        userId: user.uid,
        userName: currentUserName,
        userPhoto: currentUserPhoto,
        text: commentText.trim(),
        createdAt: serverTimestamp(),
      });

      // Send notification to post owner (function handles self-comment guard)
      await notifyCrewfieComment(
        post.userId,
        user.uid,
        currentUserName,
        post.id,
        commentText.trim()
      );

      setCommentText('');

      // Scroll to bottom to show new comment
      setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
      }, 300);
    } catch (error) {
      console.error('Error adding comment:', error);
    } finally {
      setSubmittingComment(false);
    }
  };

  // ─── Time formatting ──────────────────────────────────────────────

  const formatTime = (timestamp: any): string => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHrs = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHrs < 24) return `${diffHrs}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  // ─── Loading / Not Found States ───────────────────────────────────

  if (loading) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </ThemedView>
    );
  }

  if (notFound || !post) {
    return (
      <ThemedView style={styles.centered}>
        <Ionicons name="image-outline" size={64} color={Colors.text.disabled} />
        <ThemedText style={styles.notFoundText}>Post not found</ThemedText>
        <ThemedText style={styles.notFoundSubtext}>
          This crewfie may have been removed.
        </ThemedText>
        <TouchableOpacity style={styles.backToFeedButton} onPress={() => router.back()}>
          <ThemedText style={styles.backToFeedText}>Go Back</ThemedText>
        </TouchableOpacity>
      </ThemedView>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
      keyboardVerticalOffset={0}
    >
      <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerBackButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={Colors.text.primary} />
          </TouchableOpacity>
          <ThemedText style={styles.headerTitle}>Crewfie</ThemedText>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          ref={scrollRef}
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 20 }}
        >
          {/* Post Card */}
          <View style={styles.postCard}>
            {/* User Row */}
            <TouchableOpacity
              style={styles.userRow}
              onPress={() => router.push(`/profile/${post.userId}`)}
              activeOpacity={0.7}
            >
              {post.userPhoto ? (
                <Image source={{ uri: post.userPhoto }} style={styles.userAvatar} />
              ) : (
                <View style={styles.userAvatarFallback}>
                  <ThemedText style={styles.userAvatarText}>
                    {post.userName.charAt(0).toUpperCase()}
                  </ThemedText>
                </View>
              )}
              <View style={styles.userInfo}>
                <ThemedText style={styles.userName}>{post.userName}</ThemedText>
                <View style={styles.userMeta}>
                  {post.userAirline ? (
                    <ThemedText style={styles.userAirline}>{post.userAirline}</ThemedText>
                  ) : null}
                  {post.location ? (
                    <ThemedText style={styles.userLocation}>
                      {post.userAirline ? ' · ' : ''}📍 {post.location}
                    </ThemedText>
                  ) : null}
                </View>
              </View>
              <ThemedText style={styles.timeText}>{formatTime(post.createdAt)}</ThemedText>
            </TouchableOpacity>

            {/* Photo */}
            <Image source={{ uri: post.photoURL }} style={styles.postPhoto} />

            {/* Actions Row */}
            <View style={styles.actionsRow}>
              <TouchableOpacity style={styles.actionButton} onPress={handleLike}>
                <Ionicons
                  name={isLiked ? 'heart' : 'heart-outline'}
                  size={26}
                  color={isLiked ? Colors.error : Colors.text.primary}
                />
                {post.likes.length > 0 && (
                  <ThemedText style={[styles.actionCount, isLiked && styles.actionCountLiked]}>
                    {post.likes.length}
                  </ThemedText>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => commentInputRef.current?.focus()}
              >
                <Ionicons name="chatbubble-outline" size={24} color={Colors.text.primary} />
                {comments.length > 0 && (
                  <ThemedText style={styles.actionCount}>{comments.length}</ThemedText>
                )}
              </TouchableOpacity>
            </View>

            {/* Caption */}
            {post.content && (
              <View style={styles.captionContainer}>
                <ThemedText style={styles.captionUser}>{post.userName}</ThemedText>
                <ThemedText style={styles.captionText}> {post.content}</ThemedText>
              </View>
            )}
          </View>

          {/* Comments Section */}
          {comments.length > 0 && (
            <View style={styles.commentsSection}>
              <ThemedText style={styles.commentsHeader}>
                Comments ({comments.length})
              </ThemedText>

              {comments.map((comment) => (
                <View key={comment.id} style={styles.commentRow}>
                  <TouchableOpacity
                    onPress={() => router.push(`/profile/${comment.userId}`)}
                    activeOpacity={0.7}
                  >
                    {comment.userPhoto ? (
                      <Image source={{ uri: comment.userPhoto }} style={styles.commentAvatar} />
                    ) : (
                      <View style={styles.commentAvatarFallback}>
                        <ThemedText style={styles.commentAvatarText}>
                          {comment.userName.charAt(0).toUpperCase()}
                        </ThemedText>
                      </View>
                    )}
                  </TouchableOpacity>

                  <View style={styles.commentContent}>
                    <View style={styles.commentBubble}>
                      <ThemedText style={styles.commentUserName}>{comment.userName}</ThemedText>
                      <ThemedText style={styles.commentTextContent}>{comment.text}</ThemedText>
                    </View>
                    <ThemedText style={styles.commentTime}>
                      {formatTime(comment.createdAt)}
                    </ThemedText>
                  </View>
                </View>
              ))}
            </View>
          )}
        </ScrollView>

        {/* Comment Input Bar */}
        <View style={[styles.commentInputBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          {currentUserPhoto ? (
            <Image source={{ uri: currentUserPhoto }} style={styles.inputAvatar} />
          ) : (
            <View style={styles.inputAvatarFallback}>
              <ThemedText style={styles.inputAvatarText}>
                {currentUserName.charAt(0).toUpperCase()}
              </ThemedText>
            </View>
          )}
          <TextInput
            ref={commentInputRef}
            style={styles.commentInput}
            placeholder="Add a comment..."
            placeholderTextColor={Colors.text.secondary}
            value={commentText}
            onChangeText={setCommentText}
            maxLength={300}
            multiline
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              (!commentText.trim() || submittingComment) && styles.sendButtonDisabled,
            ]}
            onPress={handleAddComment}
            disabled={!commentText.trim() || submittingComment}
          >
            {submittingComment ? (
              <ActivityIndicator size="small" color={Colors.white} />
            ) : (
              <Ionicons name="send" size={18} color={Colors.white} />
            )}
          </TouchableOpacity>
        </View>
      </ThemedView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    gap: 12,
  },
  notFoundText: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  notFoundSubtext: {
    fontSize: 14,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
  backToFeedButton: {
    marginTop: 12,
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  backToFeedText: {
    color: Colors.white,
    fontWeight: '700',
    fontSize: 15,
  },

  // ─── Header ───────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.card,
  },
  headerBackButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text.primary,
  },

  // ─── Post Card ────────────────────────────────────────────────────
  scrollView: {
    flex: 1,
  },
  postCard: {
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 10,
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  userAvatarFallback: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAvatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.primary,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  userMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  userAirline: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.text.secondary,
  },
  userLocation: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.text.secondary,
  },
  timeText: {
    fontSize: 12,
    color: Colors.text.secondary,
  },
  postPhoto: {
    width: '100%',
    aspectRatio: 4 / 5,
    backgroundColor: Colors.border,
  },

  // ─── Actions ──────────────────────────────────────────────────────
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 20,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionCount: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  actionCountLiked: {
    color: Colors.error,
  },

  // ─── Caption ──────────────────────────────────────────────────────
  captionContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  captionUser: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  captionText: {
    fontSize: 14,
    color: Colors.text.primary,
    lineHeight: 20,
  },

  // ─── Comments ─────────────────────────────────────────────────────
  commentsSection: {
    paddingHorizontal: 14,
    paddingTop: 16,
  },
  commentsHeader: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text.secondary,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  commentRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginTop: 2,
  },
  commentAvatarFallback: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  commentAvatarText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
  },
  commentContent: {
    flex: 1,
  },
  commentBubble: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  commentUserName: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 2,
  },
  commentTextContent: {
    fontSize: 14,
    color: Colors.text.primary,
    lineHeight: 19,
  },
  commentTime: {
    fontSize: 11,
    color: Colors.text.secondary,
    marginTop: 4,
    marginLeft: 12,
  },

  // ─── Comment Input Bar ────────────────────────────────────────────
  commentInputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 10,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.card,
  },
  inputAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  inputAvatarFallback: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputAvatarText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
  },
  commentInput: {
    flex: 1,
    backgroundColor: Colors.background,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 14,
    maxHeight: 80,
    borderWidth: 1,
    borderColor: Colors.border,
    color: Colors.text.primary,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },
});
