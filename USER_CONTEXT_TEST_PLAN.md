# User Context and Identity Management Test Plan

## Setup Instructions

1. **Run the SQL Setup**: Execute the SQL from `USER_CONTEXT_SETUP.sql` in your Supabase SQL Editor
2. **Restart Server**: Restart your Node.js server to load the updated code
3. **Clear Browser Cache**: Clear browser cache and reload the application

## Test Scenarios

### Scenario 1: User Identity Recognition
1. **User 1**: 
   - Send message: "Hi, I am Nithya"
   - Send message: "Who am I?"
   - **Expected Response**: "You are Nithya!"

2. **User 2** (different browser/incognito):
   - Send message: "Hi, I am Alex"
   - Send message: "Who am I?"
   - **Expected Response**: "You are Alex!"

3. **User 1** (back to original session):
   - Send message: "Who am I?"
   - **Expected Response**: "You are Nithya!" (should remember User 1's identity)

### Scenario 2: User Preference Adaptation
1. **Gamer User**:
   - Send message: "I'm a gamer and I love playing RPGs"
   - Send message: "Tell me about character development"
   - **Expected Response**: Response should be gamer-style and mention gaming concepts

2. **Professional User**:
   - Send message: "I work as a software developer"
   - Send message: "Explain microservices"
   - **Expected Response**: Professional, technical response

### Scenario 3: Context Persistence
1. **Set Identity**: "My name is Sarah and I'm a designer"
2. **New Chat**: Create a new chat session
3. **Ask Identity**: "Who am I?"
4. **Expected Response**: "You are Sarah!" (context persists across chats)

### Scenario 4: Identity Updates
1. **Initial Identity**: "My name is John"
2. **Update Identity**: "Actually, call me Johnny"
3. **Ask Identity**: "Who am I?"
4. **Expected Response**: "You are Johnny!" (should use latest identity)

## Database Verification

Check the `user_context` table in Supabase to verify:
- Each user has exactly one record
- User isolation is working (no cross-user data)
- Context updates are persisted correctly

## Troubleshooting

### Common Issues:
1. **"Who am I?" not working**: Check that user context is being loaded in `initializeApp()`
2. **Identity not saving**: Verify Supabase RLS policies allow user updates
3. **Cross-user contamination**: Check that `user_id` is properly filtered in all queries

### Debug Console Messages:
- Look for `🧠 USER CONTEXT LOADED:` messages
- Check for `✅ IDENTITY SAVED TO CONTEXT` messages
- Verify `🧠 IDENTITY EXTRACTED:` shows correct patterns

## Success Criteria

✅ User identity is recognized correctly
✅ Different users have separate contexts  
✅ Context persists across chat sessions
✅ AI responses adapt to user preferences
✅ No cross-user data leakage
✅ Brand identity (voidzen AI) is maintained
