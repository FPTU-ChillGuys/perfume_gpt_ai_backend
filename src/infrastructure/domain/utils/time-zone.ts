import { formatInTimeZone } from "date-fns-tz"

export const getCurrentDateWithTimezone = (): string => {
    const date = new Date();
    return formatInTimeZone(date, '', 'yyyy-MM-dd HH:mm:ss zzz') // 2014-10-25 12:46:20 GMT+2
}

export const convertToUTC = (date: Date | undefined): Date => {
    if (!date) {
        return new Date();
    }
    const utcDate = new Date((new Date(date)).toISOString());
    return utcDate;
}

export const formatDateToUTC = (date: Date = new Date()): string => {
    return formatInTimeZone(date, 'UTC', 'yyyy-MM-dd HH:mm:ss zzz');
}
