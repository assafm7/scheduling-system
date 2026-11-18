package com.assignment.scheduler.scheduling.schedule;

import java.time.DayOfWeek;
import java.time.LocalTime;
import java.util.Set;

/** Fires on the given days of the week at {@code time}, in {@code timeZone}. */
public record WeeklySchedule(Set<DayOfWeek> daysOfWeek, LocalTime time, String timeZone) implements ScheduleSpec {
}
