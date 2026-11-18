package com.assignment.scheduler.scheduling;

import com.assignment.scheduler.common.Json;
import com.assignment.scheduler.scheduling.schedule.ScheduleSpec;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

@Converter
public class ScheduleSpecConverter implements AttributeConverter<ScheduleSpec, String> {

	@Override
	public String convertToDatabaseColumn(ScheduleSpec attribute) {
		return attribute == null ? null : Json.write(attribute);
	}

	@Override
	public ScheduleSpec convertToEntityAttribute(String dbData) {
		return dbData == null ? null : Json.read(dbData, ScheduleSpec.class);
	}
}
