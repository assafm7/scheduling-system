package com.assignment.scheduler.common;

/**
 * Neutralizes user-supplied text before it is written to logs, so a value cannot forge extra log lines
 * (CR/LF injection) or smuggle terminal control sequences.
 */
public final class LogSanitizer {

	private LogSanitizer() {
	}

	public static String sanitize(String value) {
		if (value == null) {
			return null;
		}
		return value.replaceAll("\\p{Cntrl}", " ");
	}
}
