package com.assignment.scheduler.task.impl;

import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import com.assignment.scheduler.common.LogSanitizer;
import com.assignment.scheduler.task.ParameterDefinition;
import com.assignment.scheduler.task.ScheduledTask;
import com.assignment.scheduler.task.TaskContext;

/** Writes a message to the application log. */
@Component
public class LogTask implements ScheduledTask {

	public static final String KEY = "LOG";

	private static final Logger log = LoggerFactory.getLogger(LogTask.class);

	@Override
	public String key() {
		return KEY;
	}

	@Override
	public String name() {
		return "Log message";
	}

	@Override
	public String description() {
		return "Writes a message to the application log at the chosen level.";
	}

	@Override
	public List<ParameterDefinition> parameters() {
		return List.of(
				ParameterDefinition.text("message", "Message", true, 1000, "Text to write to the log."),
				ParameterDefinition.choice("level", "Log level", false, List.of("INFO", "WARN", "ERROR"),
						"Defaults to INFO."));
	}

	@Override
	public void execute(TaskContext context) {
		String message = LogSanitizer.sanitize(context.requireString("message"));
		String level = context.getString("level").orElse("INFO");
		switch (level) {
			case "WARN" -> log.warn("[scheduling {}] {}", context.schedulingId(), message);
			case "ERROR" -> log.error("[scheduling {}] {}", context.schedulingId(), message);
			default -> log.info("[scheduling {}] {}", context.schedulingId(), message);
		}
	}
}
