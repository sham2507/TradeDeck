import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";

dayjs.extend(utc);
dayjs.extend(timezone);

const getExpiryTime = () => {
  const now = dayjs().tz("Asia/Kolkata");
  let next845 = now.hour(8).minute(30).second(0).millisecond(0);

  if (now.isAfter(next845)) {
    next845 = next845.add(1, "day");
  }

  const ttl = next845.unix() - now.unix();
  return ttl;
};

export default getExpiryTime;
