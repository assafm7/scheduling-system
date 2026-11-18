package com.assignment.scheduler.quartz;

import java.time.Instant;

import com.assignment.scheduler.scheduling.SchedulingStatus;

/** Runtime view of a scheduling's Quartz job. */
public record JobState(SchedulingStatus status, Instant nextFireTime) {
}
