import '../../../di/demo_data.dart';
import '../models/message_models.dart';

/// Demo conversations (Figma 4 / 4.1 copy adapted to the demo family). Times are relative to [now].
class MessagesDemoData {
  MessagesDemoData._();

  static bool _aarav(String childId) => childId == DemoData.aarav.id;

  static List<MessageContact> contacts(String childId) {
    final child = DemoData.childById(childId);
    final aarav = _aarav(childId);
    final c = child.id;
    return [
      MessageContact(
        id: 'ct_${c}_class',
        name: child.classTeacher,
        shortName: aarav ? 'Mrs. Anita' : 'Mr. Vikram',
        role: aarav
            ? 'Class ${child.className} • Mathematics PGT'
            : 'Class ${child.className} • Science',
        badge: 'Class Teacher',
        kind: ContactKind.classTeacher,
        online: true,
      ),
      MessageContact(
        id: 'ct_${c}_stem',
        name: 'Mr. Imran Khan',
        shortName: 'Mr. Imran',
        role: 'Computer Science & Robotics Mentor',
        badge: 'STEM & Robotics',
        kind: ContactKind.subjectTeacher,
      ),
      MessageContact(
        id: 'ct_${c}_sub2',
        name: aarav ? 'Mrs. Sunita Iyer' : 'Ms. Priya Menon',
        shortName: aarav ? 'Mrs. Sunita' : 'Ms. Priya',
        role: aarav ? 'Physics' : 'English',
        badge: 'Subject Teacher',
        kind: ContactKind.subjectTeacher,
        online: true,
      ),
      MessageContact(
        id: 'ct_${c}_sub3',
        name: aarav ? 'Mr. Arjun Mehta' : 'Mrs. Kavita Rao',
        shortName: aarav ? 'Mr. Arjun' : 'Mrs. Kavita',
        role: aarav ? 'Chemistry' : 'Mathematics',
        badge: 'Subject Teacher',
        kind: ContactKind.subjectTeacher,
      ),
      MessageContact(
        id: 'ct_${c}_vp',
        name: 'Dr. K.V. Rao',
        shortName: 'Dr. Rao',
        role: 'Vice Principal — Academics',
        badge: 'Leadership',
        kind: ContactKind.leadership,
      ),
      MessageContact(
        id: 'ct_${c}_fees',
        name: 'Greenfield Accounts & Fee Desk',
        shortName: 'Accounts',
        role: 'Administrative Office • Finance Counter',
        badge: 'Accounts & Billing',
        kind: ContactKind.accounts,
      ),
      MessageContact(
        id: 'ct_${c}_bus',
        name: 'Transport Helpdesk (Route #${aarav ? 14 : 9})',
        shortName: 'Transport',
        role: 'Fleet Operations Control',
        badge: 'Fleet Control',
        kind: ContactKind.transport,
      ),
    ];
  }

  static MessageThread _thread(
    MessageContact ct,
    String childId,
    String id, {
    required List<ChatMessage> chat,
    int unread = 0,
    bool pinned = false,
    bool verified = false,
  }) => MessageThread(
    id: id,
    childId: childId,
    contactId: ct.id,
    teacher: ct.name,
    role: ct.badge,
    subtitle: ct.role,
    kind: ct.kind,
    lastMessage: chat.last.text,
    lastAt: chat.last.at,
    unread: unread,
    pinned: pinned,
    verified: verified,
    online: ct.online,
  );

  static ChatMessage _m(
    String threadId,
    int i,
    bool parent,
    String text,
    DateTime at, {
    List<MessageAttachment> files = const [],
  }) => ChatMessage(
    id: '${threadId}_$i',
    threadId: threadId,
    fromParent: parent,
    text: text,
    at: at,
    attachments: files,
  );

  /// Threads and their messages for [childId].
  static ({List<MessageThread> threads, Map<String, List<ChatMessage>> chats})
  seed(String childId, {DateTime? now}) {
    final n = now ?? DateTime.now();
    final aarav = _aarav(childId);
    final child = DemoData.childById(childId);
    final first = child.firstName;
    final ct = {for (final c in contacts(childId)) c.id.split('_').last: c};
    DateTime ago({int days = 0, int hours = 0, int minutes = 0}) =>
        n.subtract(Duration(days: days, hours: hours, minutes: minutes));

    final classId = 'th_${childId}_ct';
    final stemId = 'th_${childId}_st';
    final vpId = 'th_${childId}_vp';
    final feesId = 'th_${childId}_fees';
    final busId = 'th_${childId}_bus';
    final sal = ct['class']!.salutation;
    final teacherFirst = ct['class']!.shortName.split(' ').last;

    final chats = <String, List<ChatMessage>>{
      classId: [
        _m(
          classId,
          1,
          true,
          'Namaste $teacherFirst $sal, does $first need to bring '
          '${aarav ? 'his Physics lab manual' : 'her Science journal'} tomorrow?',
          ago(hours: 3),
        ),
        _m(
          classId,
          2,
          false,
          'Namaste Sharma ji, please make sure ${aarav ? 'he' : 'she'} brings both the journal and graph sheet.',
          ago(hours: 2, minutes: 47),
        ),
        _m(
          classId,
          3,
          true,
          'Noted $sal, and thank you so much for awarding ${aarav ? 'him' : 'her'} the Academic Leadership star today!',
          ago(hours: 2, minutes: 40),
        ),
        _m(
          classId,
          4,
          false,
          '${aarav ? 'He' : 'She'} truly deserved it for ${aarav ? 'his' : 'her'} exemplary peer support during '
          '${aarav ? 'math' : 'science'} class.',
          ago(minutes: 40),
        ),
      ],
      vpId: [
        _m(
          vpId,
          1,
          false,
          'Draft agenda for the Term 2 Academic Townhall',
          ago(days: 1, hours: 2),
          files: const [
            MessageAttachment(name: 'Townhall_Agenda_Term2.pdf', sizeKb: 320),
          ],
        ),
      ],
      feesId: [
        _m(
          feesId,
          1,
          true,
          'Could you please share the receipt for the Q3 tuition fee?',
          ago(days: 3, hours: 4),
        ),
        _m(
          feesId,
          2,
          false,
          'Official e-Receipt for Q3 Tuition fee (₹14,500)',
          ago(days: 3, hours: 1),
          files: const [
            MessageAttachment(name: 'Receipt_Q3_Tuition.pdf', sizeKb: 180),
          ],
        ),
      ],
      stemId: [
        _m(
          stemId,
          1,
          true,
          'Is the robotics project deadline still Friday?',
          ago(days: 5, hours: 3),
        ),
        _m(
          stemId,
          2,
          false,
          '$first has been selected as the lead student for the inter-school robotics showcase. '
          'Project submission has been extended by two days.',
          ago(days: 5),
        ),
      ],
      busId: [
        _m(
          busId,
          1,
          false,
          'Evening route ${aarav ? 14 : 9} departure scheduled at 3:30 PM from Gate 2 during exam week.',
          ago(days: 7),
        ),
      ],
    };

    final threads = [
      _thread(
        ct['class']!,
        childId,
        classId,
        chat: chats[classId]!,
        unread: 1,
        pinned: true,
        verified: true,
      ),
      _thread(ct['vp']!, childId, vpId, chat: chats[vpId]!, verified: true),
      _thread(ct['fees']!, childId, feesId, chat: chats[feesId]!),
      _thread(ct['stem']!, childId, stemId, chat: chats[stemId]!),
      _thread(ct['bus']!, childId, busId, chat: chats[busId]!, unread: 1),
    ];
    return (threads: threads, chats: chats);
  }

  static List<MessageDraft> drafts(String childId, {DateTime? now}) {
    final n = now ?? DateTime.now();
    final aarav = _aarav(childId);
    return [
      MessageDraft(
        id: 'dr_${childId}_1',
        childId: childId,
        contactId: 'ct_${childId}_sub2',
        category: MessageCategory.academic,
        subject: aarav ? 'Physics practical notebook' : 'English reading list',
        body: aarav
            ? "Namaste Ma'am, Aarav missed Tuesday's practical. Could he complete it this week?"
            : "Namaste Ma'am, could you share the reading list for this term?",
        updatedAt: n.subtract(const Duration(days: 1, hours: 3)),
      ),
      MessageDraft(
        id: 'dr_${childId}_2',
        childId: childId,
        contactId: 'ct_${childId}_fees',
        category: MessageCategory.fees,
        subject: 'Sibling fee concession',
        updatedAt: n.subtract(const Duration(days: 4)),
      ),
    ];
  }
}
