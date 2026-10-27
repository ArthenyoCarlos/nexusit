package br.com.nexusit.support;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.web.server.ResponseStatusException;
import java.nio.file.*;
import java.time.Duration;
import java.util.concurrent.TimeUnit;
import static org.junit.jupiter.api.Assertions.*;

@EnabledIfEnvironmentVariable(named="CRM_REAL_AUDIO_TEST", matches="1")
class WhatsappAudioConverterIntegrationTest {
 @TempDir Path dir;
 private String run(String... command) throws Exception {
  Process p = new ProcessBuilder(command).redirectErrorStream(true).start();
  assertTrue(p.waitFor(60,TimeUnit.SECONDS),"Local audio tool timed out");
  String text=new String(p.getInputStream().readAllBytes());
  assertEquals(0,p.exitValue(),text);return text;
 }
 @Test void convertsTenMinuteRealWaveToIntactOpus() throws Exception {
  Path in=dir.resolve("long.wav"), out=dir.resolve("result.ogg");
  run("ffmpeg","-y","-hide_banner","-loglevel","error","-f","lavfi","-i","sine=frequency=440:sample_rate=22050","-t","600","-c:a","pcm_s16le",in.toString());
  assertTrue(Files.size(in)>1024*1024,"Fixture must exceed old 1 MB upload limit");
  var converted=new WhatsappAudioConverter().convert(Files.readAllBytes(in),"long.wav");
  Files.write(out,converted.bytes());
  assertTrue(converted.bytes().length>0 && converted.bytes().length<=16*1024*1024);
  assertEquals("audio/ogg; codecs=opus",converted.mime());
  String probe=run("ffprobe","-v","error","-show_entries","stream=codec_name,sample_rate,channels:format=duration","-of","default=noprint_wrappers=1",out.toString());
  assertTrue(probe.contains("codec_name=opus"));assertTrue(probe.contains("sample_rate=48000"));assertTrue(probe.contains("channels=1"));
  double duration=Double.parseDouble(probe.lines().filter(s->s.startsWith("duration=")).findFirst().orElseThrow().substring(9));
  assertEquals(600,duration,0.2,"Audio must not be truncated");
  System.out.println("REAL_AUDIO_PROOF inputBytes="+Files.size(in)+" outputBytes="+converted.bytes().length+" durationSeconds="+duration+" codec=opus sampleRate=48000 channels=1");
 }
 @Test void hungConverterHasEffectiveTimeoutAndIsTerminated() throws Exception {
  Path script=dir.resolve("hang.sh"),pid=dir.resolve("pid");
  Files.writeString(script,"#!/bin/sh\necho $$ > '"+pid+"'\nexec sleep 30\n");
  assertTrue(script.toFile().setExecutable(true));
  long start=System.nanoTime();
  var error=assertThrows(ResponseStatusException.class,()->new WhatsappAudioConverter(script.toString(),Duration.ofMillis(150)).convert(new byte[]{1,2,3},"x.wav"));
  assertEquals(504,error.getStatusCode().value());assertTrue(Duration.ofNanos(System.nanoTime()-start).toMillis()<3000);
  long id=Long.parseLong(Files.readString(pid).trim());
  assertFalse(ProcessHandle.of(id).map(ProcessHandle::isAlive).orElse(false),"Timed out converter must be reaped");
 }
}
