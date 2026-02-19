import { Queue } from 'bullmq';

const queue = new Queue('conversation_queue', {
  connection: { host: '127.0.0.1', port: 6379 },
});

// Xóa dữ liệu queue
(async () => {
  await queue.drain();     // xoá job trong wait/active/delayed
  await queue.clean(0, 1000);    // xoá job completed/failed
  await queue.obliterate({ force: true }); // xoá tất cả key liên quan

  await queue.close();
})();