import { formatInTimeZone } from "date-fns-tz"

export const getCurrentDateWithTimezone = (): string => {
    const date = new Date();
    return formatInTimeZone(date, '', 'yyyy-MM-dd HH:mm:ss zzz') // 2014-10-25 12:46:20 GMT+2
}