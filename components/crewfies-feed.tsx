import { ThemedText } from '@/components/themed-text';
import { db } from '@/config/firebase';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { notifyCrewfikeLike, notifyCrewfieComment } from '@/utils/notifications';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

type Post = {
  id: string;
  userId: string;
  userName: string;
  userAirline: string;
  userPhoto?: string;
  content?: string;
  photoURL?: string;
  likes: string[];
  commentCount: number;
  createdAt: any;
  location?: string;
};

type Comment = {
  id: string;
  userId: string;
  userName: string;
  userPhoto?: string;
  text: string;
  createdAt: any;
};

type CrewfiesFeedProps = {
  initialLimit?: number; // If provided, shows limited view with "View More" button
};

// Helper function to format timestamp
const formatTimestamp = (timestamp: any): string => {
  if (!timestamp) return '';
  
  const now = new Date();
  const postDate = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const diffMs = now.getTime() - postDate.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  // Format as "Jan 12"
  return postDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

export default function CrewfiesFeed({ initialLimit }: CrewfiesFeedProps) {
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedPostId, setExpandedPostId] = useState<string | null>(null);
  const [comments, setComments] = useState<{ [postId: string]: Comment[] }>({});
  const [commentText, setCommentText] = useState('');
  const [loadingComments, setLoadingComments] = useState<{ [postId: string]: boolean }>({});
  const [showingAll, setShowingAll] = useState(!initialLimit);
  const [currentUserName, setCurrentUserName] = useState('');

  // ─── Fetch current user's display name (needed for notifications) ──
  useEffect(() => {
    if (!user?.uid) return;

    const unsubscribe = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
      if (docSnap.exists()) {
        setCurrentUserName(docSnap.data().displayName || 'Unknown');
      }
    });

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    const postsQuery = query(
      collection(db, 'posts'),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(postsQuery, async (snapshot) => {
      const fetchedPosts: Post[] = [];
      
      for (const postDoc of snapshot.docs) {
        const postData = postDoc.data();
        
        // Count comments for this post
        const commentsSnapshot = await getDocs(
          collection(db, 'posts', postDoc.id, 'comments')
        );
        
        fetchedPosts.push({
          id: postDoc.id,
          ...postData,
          commentCount: commentsSnapshot.size,
        } as Post);
      }
      
      setPosts(fetchedPosts);
      setLoading(false);
      setRefreshing(false);
    });

    return () => unsubscribe();
  }, []);

  const loadComments = async (postId: string) => {
    if (loadingComments[postId]) return;
    
    setLoadingComments(prev => ({ ...prev, [postId]: true }));
    
    const commentsQuery = query(
      collection(db, 'posts', postId, 'comments'),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(commentsQuery, (snapshot) => {
      const fetchedComments: Comment[] = [];
      snapshot.docs.forEach(doc => {
        fetchedComments.push({
          id: doc.id,
          ...doc.data(),
        } as Comment);
      });
      setComments(prev => ({ ...prev, [postId]: fetchedComments }));
      setLoadingComments(prev => ({ ...prev, [postId]: false }));
    });

    return unsubscribe;
  };

  const handleRefresh = () => {
    setRefreshing(true);
  };

  // ─── Like handler — now sends push notification on new likes ───────
  const handleLike = async (post: Post) => {
    if (!user) return;

    const postRef = doc(db, 'posts', post.id);
    const isLiked = post.likes.includes(user.uid);

    try {
      if (isLiked) {
        await updateDoc(postRef, {
          likes: arrayRemove(user.uid)
        });
      } else {
        await updateDoc(postRef, {
          likes: arrayUnion(user.uid)
        });

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
      console.error('Error liking post:', error);
    }
  };

  const handleUserPress = async (userId: string) => {
    if (!user) return;

    // If clicking own name, go to profile tab
    if (userId === user.uid) {
      router.push('/(tabs)/profile');
      return;
    }

    // Check if connected
    const connectionsQuery = query(
      collection(db, 'connections'),
      where('userIds', 'array-contains', user.uid)
    );
    const connectionsSnapshot = await getDocs(connectionsQuery);
    const isConnected = connectionsSnapshot.docs.some(doc => {
      const data = doc.data();
      return data.userIds.includes(userId);
    });

    if (isConnected) {
      router.push({
        pathname: '/profile/friend/[userId]',
        params: { userId }
      });
    } else {
      router.push({
        pathname: '/profile/[userId]',
        params: { userId }
      });
    }
  };

  const toggleComments = async (postId: string) => {
    if (expandedPostId === postId) {
      setExpandedPostId(null);
    } else {
      setExpandedPostId(postId);
      if (!comments[postId]) {
        await loadComments(postId);
      }
    }
  };

  // ─── Comment handler — now sends push notification ─────────────────
  const handleAddComment = async (postId: string, postOwnerId: string) => {
    if (!user || !commentText.trim()) return;

    try {
      const userDoc = await getDocs(query(collection(db, 'users'), where('__name__', '==', user.uid)));
      const userData = userDoc.docs[0]?.data();
      const userName = userData?.displayName || 'Unknown';

      await addDoc(collection(db, 'posts', postId, 'comments'), {
        userId: user.uid,
        userName,
        userPhoto: userData?.photoURL || null,
        text: commentText.trim(),
        createdAt: serverTimestamp(),
      });

      // Send notification to post owner (function handles self-comment guard)
      await notifyCrewfieComment(
        postOwnerId,
        user.uid,
        userName,
        postId,
        commentText.trim()
      );

      setCommentText('');
    } catch (error) {
      console.error('Error adding comment:', error);
      Alert.alert('Error', 'Failed to post comment. Please try again.');
    }
  };

  const renderPost = (item: Post) => {
    const isLiked = item.likes.includes(user?.uid || '');
    const showComments = expandedPostId === item.id;
    const postComments = comments[item.id] || [];

    return (
      <View key={item.id} style={styles.postCard}>
        {/* Header */}
        <TouchableOpacity 
          style={styles.postHeader}
          onPress={() => handleUserPress(item.userId)}
        >
          {item.userPhoto ? (
            <Image source={{ uri: item.userPhoto }} style={styles.postAvatar} />
          ) : (
            <View style={styles.postAvatarFallback}>
              <ThemedText style={styles.postAvatarText}>
                {item.userName.slice(0, 2).toUpperCase()}
              </ThemedText>
            </View>
          )}
          <View style={styles.postUserInfo}>
            <ThemedText style={styles.postUserName}>{item.userName}</ThemedText>
            <View style={styles.postMetaRow}>
              <ThemedText style={styles.postUserAirline}>{item.userAirline}</ThemedText>
              {item.location && (
                <>
                  <ThemedText style={styles.postMetaDot}> • </ThemedText>
                  <Ionicons name="location" size={12} color={Colors.text.secondary} />
                  <ThemedText style={styles.postLocation}>{item.location}</ThemedText>
                </>
              )}
            </View>
            <ThemedText style={styles.postTimestamp}>{formatTimestamp(item.createdAt)}</ThemedText>
          </View>
        </TouchableOpacity>

        {/* Photo */}
        {item.photoURL && (
          <Image source={{ uri: item.photoURL }} style={styles.postImage} />
        )}
        
        {/* Caption */}
        {item.content && (
          <View style={styles.postContentContainer}>
            <ThemedText style={styles.postContent}>{item.content}</ThemedText>
          </View>
        )}

        {/* Actions */}
        <View style={styles.postActions}>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => handleLike(item)}
          >
            <Ionicons 
              name={isLiked ? "heart" : "heart-outline"} 
              size={24} 
              color={isLiked ? Colors.error : Colors.text.secondary} 
            />
            {item.likes.length > 0 && (
              <ThemedText style={styles.actionText}>{item.likes.length}</ThemedText>
            )}
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => toggleComments(item.id)}
          >
            <Ionicons name="chatbubble-outline" size={22} color={Colors.text.secondary} />
            {item.commentCount > 0 && (
              <ThemedText style={styles.actionText}>{item.commentCount}</ThemedText>
            )}
          </TouchableOpacity>
        </View>

        {/* Comments Section */}
        {showComments && (
          <View style={styles.commentsSection}>
            {loadingComments[item.id] ? (
              <ActivityIndicator size="small" color={Colors.primary} style={{ paddingVertical: 20 }} />
            ) : (
              <>
                {postComments.map((comment) => (
                  <View key={comment.id} style={styles.commentCard}>
                    <TouchableOpacity onPress={() => handleUserPress(comment.userId)}>
                      {comment.userPhoto ? (
                        <Image source={{ uri: comment.userPhoto }} style={styles.commentAvatar} />
                      ) : (
                        <View style={styles.commentAvatarFallback}>
                          <ThemedText style={styles.commentAvatarText}>
                            {comment.userName.slice(0, 2).toUpperCase()}
                          </ThemedText>
                        </View>
                      )}
                    </TouchableOpacity>
                    <View style={styles.commentContent}>
                      <TouchableOpacity onPress={() => handleUserPress(comment.userId)}>
                        <ThemedText style={styles.commentUserName}>
                          {comment.userName}
                        </ThemedText>
                      </TouchableOpacity>
                      <ThemedText style={styles.commentText}>{comment.text}</ThemedText>
                    </View>
                  </View>
                ))}

                {/* Add Comment Input */}
                <KeyboardAvoidingView 
                  behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                  keyboardVerticalOffset={100}
                >
                  <View style={styles.addCommentContainer}>
                    <TextInput
                      style={styles.commentInput}
                      placeholder="Add a comment..."
                      placeholderTextColor={Colors.text.secondary}
                      value={commentText}
                      onChangeText={setCommentText}
                      multiline
                    />
                    <TouchableOpacity 
                      onPress={() => handleAddComment(item.id, item.userId)}
                      disabled={!commentText.trim()}
                    >
                      <Ionicons 
                        name="send" 
                        size={24} 
                        color={commentText.trim() ? Colors.primary : Colors.text.disabled} 
                      />
                    </TouchableOpacity>
                  </View>
                </KeyboardAvoidingView>
              </>
            )}
          </View>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  // Get posts to display
  const displayPosts = showingAll || !initialLimit 
    ? posts 
    : posts.slice(0, initialLimit);

  // If initialLimit is set, use View with map() to avoid FlatList nesting
  if (initialLimit) {
    return (
      <View>
        <View style={styles.feedContent}>
          {displayPosts.length > 0 ? (
            displayPosts.map((item) => renderPost(item))
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="images-outline" size={80} color={Colors.text.secondary} />
              <ThemedText style={styles.emptyTitle}>No crewfies yet</ThemedText>
              <ThemedText style={styles.emptyText}>
                Be the first to share a crewfie!
              </ThemedText>
              <TouchableOpacity 
                style={styles.emptyButton}
                onPress={() => router.push('/create-post')}
              >
                <ThemedText style={styles.emptyButtonText}>Create Post</ThemedText>
              </TouchableOpacity>
            </View>
          )}
        </View>
        
        {/* View More Button */}
        {posts.length > initialLimit && (
          <TouchableOpacity 
            style={styles.viewMoreButton}
            onPress={() => setShowingAll(true)}
          >
            <ThemedText style={styles.viewMoreText}>
              View More ({posts.length - initialLimit} more)
            </ThemedText>
            <Ionicons name="chevron-down" size={18} color={Colors.primary} />
          </TouchableOpacity>
        )}
      </View>
    );
  }

  // Full view with FlatList (for standalone use or when showing all)
  return (
    <FlatList
      data={posts}
      renderItem={({ item }) => renderPost(item)}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.feedContent}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }
      ListEmptyComponent={
        <View style={styles.emptyState}>
          <Ionicons name="images-outline" size={80} color={Colors.text.secondary} />
          <ThemedText style={styles.emptyTitle}>No crewfies yet</ThemedText>
          <ThemedText style={styles.emptyText}>
            Be the first to share a crewfie!
          </ThemedText>
          <TouchableOpacity 
            style={styles.emptyButton}
            onPress={() => router.push('/create-post')}
          >
            <ThemedText style={styles.emptyButtonText}>Create Post</ThemedText>
          </TouchableOpacity>
        </View>
      }
      showsVerticalScrollIndicator={false}
    />
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  feedContent: {
    paddingBottom: 20,
  },
  postCard: {
    backgroundColor: Colors.card,
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  postAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  postAvatarFallback: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  postAvatarText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.white,
  },
  postUserInfo: {
    flex: 1,
  },
  postUserName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  postMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  postUserAirline: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  postMetaDot: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginHorizontal: 4,
  },
  postLocation: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginLeft: 2,
  },
  postTimestamp: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginTop: 4,
  },
  postImage: {
    width: '100%',
    height: 400,
    backgroundColor: Colors.background,
  },
  postContentContainer: {
    padding: 12,
  },
  postContent: {
    fontSize: 16,
    color: Colors.text.primary,
    lineHeight: 22,
  },
  postActions: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: 20,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  actionText: {
    fontSize: 14,
    color: Colors.text.secondary,
    fontWeight: '600',
  },
  commentsSection: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 12,
  },
  commentCard: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 10,
  },
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  commentAvatarFallback: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentAvatarText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: Colors.white,
  },
  commentContent: {
    flex: 1,
  },
  commentUserName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 2,
  },
  commentText: {
    fontSize: 14,
    color: Colors.text.primary,
    lineHeight: 20,
  },
  addCommentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  commentInput: {
    flex: 1,
    backgroundColor: Colors.background,
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 8,
    fontSize: 14,
    color: Colors.text.primary,
    maxHeight: 100,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingTop: 100,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginTop: 20,
    marginBottom: 10,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginBottom: 30,
  },
  emptyButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 12,
  },
  emptyButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  viewMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    paddingHorizontal: 20,
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 20,
    backgroundColor: Colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  viewMoreText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.primary,
  },
});
