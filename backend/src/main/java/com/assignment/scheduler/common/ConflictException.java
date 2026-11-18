package com.assignment.scheduler.common;

/** The client tried to update a resource based on a stale version. */
public class ConflictException extends RuntimeException {

	public ConflictException(String message) {
		super(message);
	}
}
