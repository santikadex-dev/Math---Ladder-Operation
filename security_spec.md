# Security Specification — Math Ladder: Class Race

## Data Invariants
1. A Room (`/rooms/{roomId}`) can only be created and controlled by an authenticated, email-verified Teacher (`teacherId == request.auth.uid`), and `roomId` must equal `roomCode` matching `^[A-Z0-9\-]+$` (4–16 chars).
2. A Room in terminal state (`status == 'FINISHED'`) cannot be mutated back to active play; updates are locked after finish.
3. A Player (`/rooms/{roomId}/players/{playerId}`) must match `playerId == request.auth.uid` on creation, start at `position == 1`, `xp == 0`, `finished == false`, and can only join when the room exists, is unlocked, and is `WAITING` (or `PLAYING` when `settings.allowLateJoin == true`).
4. A Student CANNOT modify their own `position`, `xp`, `level`, `gold`, `correctAnswers`, `incorrectAnswers`, `timeoutCount`, `streak`, `bestStreak`, `accuracy`, `finished`, `shield`, or `doubleDiceNext`. Only the Room Teacher can mutate game progression fields.
5. Round Secrets (`/rooms/{roomId}/roundSecrets/{roundId}`) containing `correctAnswer` are strictly readable and writable ONLY by the Room Teacher (`isRoomTeacher(roomId)`). Students receive `PERMISSION_DENIED`.
6. Answer submissions (`/rooms/{roomId}/answers/{answerId}`) use deterministic IDs `${roundId}_${playerId}`, can only be created once per round by `request.auth.uid == playerId`, must reference an existing `ACTIVE` round, and must use `submittedAt == request.time`. Only the Room Teacher can update grading fields (`isCorrect`, `correctAnswer`, `responseTimeMs`).

## The "Dirty Dozen" Adversarial Payloads (Must Return PERMISSION_DENIED)
1. **Unauthenticated Room Creation**: `create /rooms/MATH-1111` with `request.auth == null`.
2. **Teacher Spoofing**: `create /rooms/MATH-2222` with `teacherId: "other-uid"` != `request.auth.uid`.
3. **Ghost Field Shadow Write on Room**: `create /rooms/MATH-3333` including extra field `isAdminRoom: true`.
4. **Student Mutating Teacher Settings**: Student updates `/rooms/MATH-7K4P` changing `settings` or `status`.
5. **Finished Room Mutation**: Teacher updates `/rooms/MATH-7K4P` after `status == 'FINISHED'`.
6. **Student Joining Locked Room**: Student creates `/rooms/MATH-7K4P/players/{uid}` when room `locked == true`.
7. **Student Self-Position Cheat**: Student creates player doc with `position: 99` or updates `position: 100`.
8. **Student Score/XP Cheat**: Student updates `xp: 9999` or `correctAnswers: 20` on their player doc.
9. **Student Reading Answer Key**: Student calls `get /rooms/MATH-7K4P/roundSecrets/round_1`.
10. **Student Spoofing Another Student's Answer**: Student A creates `/rooms/MATH-7K4P/answers/round_1_studentB` with `playerId: "studentB"`.
11. **Duplicate / Replay Answer Update**: Student updates their existing `/rooms/MATH-7K4P/answers/round_1_studentA` to change `submittedAnswer`.
12. **Client Timestamp Forgery**: Student creates answer with `submittedAt: Timestamp.fromDate(...)` instead of `request.time`.
