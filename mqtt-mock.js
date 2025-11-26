import mqtt from "mqtt";

const client = mqtt.connect("mqtt://localhost:1883");
const topic = "mixsense/weight";

client.on("connect", () => {
  console.log("Mock MQTT connected");

  setInterval(() => {
    const fakeWeight = (Math.random() * 50).toFixed(2);
    client.publish(topic, fakeWeight);
    console.log("Published weight:", fakeWeight);
  }, 1000);
});
