package com.assignment.scheduler.scheduling.schedule;

import java.time.Duration;

public enum IntervalUnit {
	MINUTES(Duration.ofMinutes(1)), HOURS(Duration.ofHours(1)), DAYS(Duration.ofDays(1));

	private final Duration duration;

	IntervalUnit(Duration duration) {
		this.duration = duration;
	}

	public Duration times(int amount) {
		return duration.multipliedBy(amount);
	}
}
