package com.assignment.scheduler.quartz;

/** Unchecked wrapper for Quartz failures, so they roll back the surrounding transaction. */
public class SchedulingEngineException extends RuntimeException {

	public SchedulingEngineException(String message, Throwable cause) {
		super(message, cause);
	}
}
