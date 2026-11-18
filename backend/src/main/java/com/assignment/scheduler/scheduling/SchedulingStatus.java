package com.assignment.scheduler.scheduling;

public enum SchedulingStatus {
	/** Will fire at its next fire time. */
	ACTIVE,
	/** Disabled by the user; the trigger is paused. */
	PAUSED,
	/** Nothing left to fire (e.g. a one-time schedule that already ran). */
	COMPLETED
}
