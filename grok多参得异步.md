一、创建视频任务
1. 纯文本生视频

curl -X POST http://你的API地址/v1/videos \
  -H "Authorization: Bearer sk-你的key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "grok-imagine-1.0-video-landscape-15s",
    "prompt": "日落时分，海浪拍打沙滩，镜头缓缓推进"
  }'
2. 单图生视频

curl -X POST http://你的API地址/v1/videos \
  -H "Authorization: Bearer sk-你的key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "grok-imagine-1.0-video-portrait-10s",
    "prompt": "让这张图片动起来",
    "image": "https://example.com/image.jpg"
  }'
3. 多图参考生视频（最多5张）

curl -X POST http://你的API地址/v1/videos \
  -H "Authorization: Bearer sk-你的key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "grok-imagine-1.0-video",
    "prompt": "@img1 作为开头，@img2 作为结尾，@img3 作为风格参考",
    "image": [
      "https://example.com/image1.jpg",
      "https://example.com/image2.jpg",
      "https://example.com/image3.jpg"
    ]
  }'


创建任务返回示例

{
  "id": "task_abc123",
  "object": "video",
  "created_at": 1710345600,
  "status": "queued",
  "model": "grok-imagine-1.0-video",
  "prompt": "一只猫在草地上奔跑",
  "progress": 0,
  "video_url": null,
  "aspect_ratio": "16:9"
}


二、查询任务状态
两个端点等价，随便用哪个：


# 方式1
curl http://你的API地址/v1/videos/{task_id} \
  -H "Authorization: Bearer sk-你的key"

# 方式2
curl http://你的API地址/v1/tasks/{task_id} \
  -H "Authorization: Bearer sk-你的key"
排队中

{
  "id": "task_abc123",
  "object": "video",
  "created_at": 1710345600,
  "status": "queued",
  "model": "grok-imagine-1.0-video",
  "prompt": "一只猫在草地上奔跑",
  "progress": 10,
  "video_url": null
}
处理中

{
  "id": "task_abc123",
  "status": "in_progress",
  "progress": 50,
  "video_url": null
}
已完成

{
  "id": "task_abc123",
  "status": "completed",
  "progress": 100,
  "video_url": "https://xxx.r2.cloudflarestorage.com/xxx.mp4",
  "completed_at": 1710345700
}
失败

{
  "id": "task_abc123",
  "status": "failed",
  "progress": 0,
  "video_url": null,
  "error": {"message": "生成失败", "code": "generation_failed"}
}
三、简化版异步接口（向后兼容）
提交任务

curl -X POST http://你的API地址/v1/async/video/generate \
  -H "Authorization: Bearer sk-你的key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "grok-imagine-1.0-video",
    "prompt": "让这张图片动起来",
    "image": "https://example.com/image.jpg",
    "aspect_ratio": "16:9",
    "duration": 10,
    "resolution": "720p"
  }'
返回：


{
  "success": true,
  "task_id": "task_abc123",
  "queue_position": 3,
  "message": "任务已提交，队列位置: 3"
}
查询状态

curl http://你的API地址/v1/async/video/status/{task_id} \
  -H "Authorization: Bearer sk-你的key"
返回：


{
  "success": true,
  "task_id": "task_abc123",
  "status": 3,
  "status_name": "已完成",
  "video_url": "https://xxx.r2.cloudflarestorage.com/xxx.mp4",
  "error": null
}
四、状态码对照
status	名称	progress	说明
queued	排队中	0-10	等待处理
in_progress	处理中	50	正在生成
completed	已完成	100	有 video_url
failed	失败	0	有 error
cancelled	已取消	0	任务被取消
五、参数总览
参数	类型	必填	说明
model	string	是	模型名称
prompt	string	是	描述词，多图用 @img1 @img2 定位
image	string/array	否	图片URL，多图传数组，最多5张
input_reference	string	否	等同 image，二选一
aspect_ratio	string	否	16:9 / 9:16，专用模型可不传
duration	number	否	6 / 10 / 15 秒（简化版接口）
resolution	string	否	720p（简化版接口）
六、典型轮询流程

# 1. 提交任务
TASK_ID=$(curl -s -X POST http://你的API地址/v1/videos \
  -H "Authorization: Bearer sk-你的key" \
  -H "Content-Type: application/json" \
  -d '{"model":"grok-imagine-1.0-video","prompt":"猫在跑"}' | jq -r '.id')

# 2. 轮询查状态（每5秒查一次）
while true; do
  RESULT=$(curl -s http://你的API地址/v1/videos/$TASK_ID \
    -H "Authorization: Bearer sk-你的key")
  STATUS=$(echo $RESULT | jq -r '.status')
  echo "状态: $STATUS"
  
  if [ "$STATUS" = "completed" ]; then
    echo "视频地址: $(echo $RESULT | jq -r '.video_url')"
    break
  elif [ "$STATUS" = "failed" ]; then
    echo "失败: $(echo $RESULT | jq -r '.error.message')"
    break
  fi
  
  sleep 5
done