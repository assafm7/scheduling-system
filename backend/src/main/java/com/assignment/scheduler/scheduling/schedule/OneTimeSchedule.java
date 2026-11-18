package com.assignment.scheduler.scheduling.schedule;

import java.time.LocalDateTime;

/** Fires once at {@code runAt}, interpreted in {@code timeZone}. */
public record OneTimeSchedule(LocalDateTime runAt, String timeZone) implements ScheduleSpec {
}
