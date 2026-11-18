package com.assignment.scheduler.scheduling.schedule;

/**
 * Quartz cron expression: {@code sec min hour day-of-month month day-of-week [year]}, evaluated in {@code timeZone}.
 */
public record CronSchedule(String expression, String timeZone) implements ScheduleSpec {
}
