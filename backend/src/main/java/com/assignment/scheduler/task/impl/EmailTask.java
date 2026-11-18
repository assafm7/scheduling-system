package com.assignment.scheduler.task.impl;

import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import com.assignment.scheduler.common.LogSanitizer;
import com.assignment.scheduler.task.ParameterDefinition;
import com.assignment.scheduler.task.ScheduledTask;
import com.assignment.scheduler.task.TaskContext;

/** Dummy email sender: logs what would be sent instead of talking to an SMTP server. */
@Component
public class EmailTask implements ScheduledTask {

	public static final String KEY = "EMAIL";

	private static final Logger log = LoggerFactory.getLogger(EmailTask.class);

	@Override
	public String key() {
		return KEY;
	}

	@Override
	public String name() {
		return "Send email (simulated)";
	}

	@Override
	public String description() {
		return "Simulates sending an email: the message is logged, nothing leaves the system.";
	}

	@Override
	public List<ParameterDefinition> parameters() {
		return List.of(
				ParameterDefinition.email("to", "To", true, "Recipient email address."),
				ParameterDefinition.text("subject", "Subject", true, 200, null),
				ParameterDefinition.text("body", "Body", false, 2000, null));
	}

	@Override
	public void execute(TaskContext context) {
		String body = context.getString("body").orElse("");
		log.info("[scheduling {}] Simulated email to <{}> with subject \"{}\" ({} characters)",
				context.schedulingId(),
				LogSanitizer.sanitize(context.requireString("to")),
				LogSanitizer.sanitize(context.requireString("subject")),
				body.length());
	}
}
