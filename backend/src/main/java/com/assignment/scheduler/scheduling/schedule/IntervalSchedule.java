package com.assignment.scheduler.scheduling.schedule;

/** Fires every {@code every} {@code unit}s, starting one interval after it is (re)scheduled. */
public record IntervalSchedule(Integer every, IntervalUnit unit, String timeZone) implements ScheduleSpec {
}
