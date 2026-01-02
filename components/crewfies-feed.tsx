import { ThemedText } from '@/components/themed-text';
import { db } from '@/config/firebase';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  doc,
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
};

type Comment = {
  id: string;
  userId: string;
  userName: string;
  userPhoto?: string;
  text: string;
  createdAt: any;
};

export default function CrewfiesFeed() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedPostId, setExpandedPostId] = useState<string | null>(null);
  const [comments, setComments] = useState<{ [postId: string]: Comment[] }>({});
  const [commentText, setCommentText] = useState('');
  const [loadingComments, setLoadingComments] = useState<{ [postId: string]: boolean }>({});

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

  const handleLike = async (postId: string, currentLikes: string[]) => {
    if (!user) return;

    const postRef = doc(db, 'posts', postId);
    const isLiked = currentLikes.includes(user.uid);

    try {
      if (isLiked) {
        await updateDoc(postRef, {
          likes: arrayRemove(user.uid)
        });
      } else {
        await updateDoc(postRef, {
          likes: arrayUnion(user.uid)
        });
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

  const handleAddComment = async (postId: string) => {
    if (!user || !commentText.trim()) return;

    try {
      const userDoc = await getDocs(query(collection(db, 'users'), where('__name__', '==', user.uid)));
      const userData = userDoc.docs[0]?.data();

      await addDoc(collection(db, 'posts', postId, 'comments'), {
        userId: user.uid,
        userName: userData?.displayName || 'Unknown',
        userPhoto: userData?.photoURL || null,
        text: commentText.trim(),
        createdAt: serverTimestamp(),
      });

      setCommentText('');
    } catch (error) {
      console.error('Error adding comment:', error);
      Alert.alert('Error', 'Failed to post comment. Please try again.');
    }
  };

  const renderPost = ({ item }: { item: Post }) => {
    const isLiked = item.likes.includes(user?.uid || '');
    const showComments = expandedPostId === item.id;
    const postComments = comments[item.id] || [];

    return (
      <View style={styles.postCard}>
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
            <ThemedText style={styles.postUserAirline}>{item.userAirline}</ThemedText>
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
            onPress={() => handleLike(item.id, item.likes)}
          >
            <Ionicons 
              name={isLiked ? "heart" : "heart-outline"} 
              size={24} 
              color={isLiked ? Colors.error : Colors.text.primary} 
            />
            {item.likes.length > 0 && (
              <ThemedText style={styles.actionText}>
                {item.likes.length}
              </ThemedText>
            )}
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => toggleComments(item.id)}
          >
            <Ionicons 
              name={showComments ? "chatbubble" : "chatbubble-outline"} 
              size={22} 
              color={Colors.text.primary} 
            />
            {item.commentCount > 0 && (
              <ThemedText style={styles.actionText}>
                {item.commentCount}
              </ThemedText>
            )}
          </TouchableOpacity>
        </View>

        {/* Comments Section */}
        {showComments && (
          <View style={styles.commentsSection}>
            {loadingComments[item.id] ? (
              <ActivityIndicator size="small" color={Colors.primary} style={{ marginVertical: 20 }} />
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
                      onPress={() => handleAddComment(item.id)}
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

  return (
    <FlatList
      data={posts}
      renderItem={renderPost}
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
  postUserAirline: {
    fontSize: 14,
    color: Colors.text.secondary,
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
});